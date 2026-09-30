import { supabaseAdmin } from "../config/supabase";

/**
 * The contract exposes rooms and equipment through one `resources` shape, but
 * they live in two tables. These helpers are the single place that knows which
 * table owns a row, so routes never branch on it themselves.
 */
export type ResourceType = "room" | "equipment";
export type ResourceTable = "facilities" | "equipment";

const TABLES: ResourceTable[] = ["facilities", "equipment"];

const TYPE_FOR: Record<ResourceTable, ResourceType> = {
  facilities: "room",
  equipment: "equipment",
};

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  capacity: number | null;
  description: string | null;
  hourly_rate: number | null;
  active: boolean;
  created_at: string;
}

export function shapeResource(
  table: ResourceTable,
  row: Record<string, any>,
): Resource {
  return {
    id: row.id,
    name: row.name,
    type: TYPE_FOR[table],
    capacity: row.capacity ?? null,
    description: row.description ?? null,
    hourly_rate: table === "facilities" ? (row.hourly_rate ?? null) : null,
    active: Boolean(row.active),
    created_at: row.created_at,
  };
}

/**
 * Returns which table owns an id, or null when neither does. Facilities are
 * checked first because ids are unique per table and both are looked up anyway.
 */
export async function resolveResource(
  id: string,
): Promise<{ table: ResourceTable; type: ResourceType; resource: Resource } | null> {
  for (const table of TABLES) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (data) return { table, type: TYPE_FOR[table], resource: shapeResource(table, data) };
  }
  return null;
}

export async function getResourceById(id: string): Promise<Resource | null> {
  return (await resolveResource(id))?.resource ?? null;
}

/**
 * Both tables, merged and ordered by name.
 *
 * ponytail: both are fetched whole and filtered in JS, which is fine for a
 * single community hub's handful of rooms. Push the filters into PostgREST if
 * the catalogue ever grows enough for that round trip to matter.
 */
export async function listResources(): Promise<Resource[]> {
  const results = await Promise.all(
    TABLES.map((table) =>
      supabaseAdmin
        .from(table)
        .select("*")
        .then(({ data, error }) => {
          if (error) throw error;
          return (data ?? []).map((row: Record<string, any>) => shapeResource(table, row));
        }),
    ),
  );

  return results.flat().sort((a, b) => a.name.localeCompare(b.name));
}