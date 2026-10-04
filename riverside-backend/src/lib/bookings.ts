import { supabaseAdmin } from "../config/supabase";

/**
 * Which side of the resource split a booking belongs to. The contract names a
 * single `resource_id`, but the two columns stay because they carry the foreign
 * keys and let conflict checks target one table without an extra lookup.
 */
export interface BookingTarget {
  facilityId?: string | null;
  equipmentId?: string | null;
}

/**
 * Ids of approved bookings that overlap the window on the same resource.
 *
 * Only `approved` blocks a slot. Pending requests are not exclusive, and
 * approval re-runs this same check, so two members can request the same slot and
 * the loser is rejected there rather than at request time.
 *
 * `excludeId` skips the booking being re-checked, which is what approval needs
 * so a booking never conflicts with itself.
 */
export async function findApprovedOverlaps(
  target: BookingTarget,
  startAt: string,
  endAt: string,
  excludeId?: string,
): Promise<string[]> {
  let query = supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("status", "approved")
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  if (target.facilityId) query = query.eq("facility_id", target.facilityId);
  if (target.equipmentId) query = query.eq("equipment_id", target.equipmentId);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}

/**
 * Approved bookings on one resource inside a window. Availability needs the
 * actual spans rather than a yes/no, so that a booking covering only part of
 * the day blocks just the slots it touches.
 */
export async function resourceBookingsWithin(
  target: BookingTarget,
  startAt: string,
  endAt: string,
): Promise<{ start_at: string; end_at: string }[]> {
  let query = supabaseAdmin
    .from("bookings")
    .select("start_at, end_at")
    .eq("status", "approved")
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  if (target.facilityId) query = query.eq("facility_id", target.facilityId);
  if (target.equipmentId) query = query.eq("equipment_id", target.equipmentId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as { start_at: string; end_at: string }[];
}

/** Facility and equipment booked in the window, so listings can flag clashes. */
export async function bookingsWithin(
  startAt: string,
  endAt: string,
): Promise<{ facilityIds: Set<string>; equipmentIds: Set<string> }> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("facility_id, equipment_id")
    .eq("status", "approved")
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  if (error) throw error;

  const facilityIds = new Set<string>();
  const equipmentIds = new Set<string>();
  for (const row of data ?? []) {
    if (row.facility_id) facilityIds.add(row.facility_id);
    if (row.equipment_id) equipmentIds.add(row.equipment_id);
  }
  return { facilityIds, equipmentIds };
}