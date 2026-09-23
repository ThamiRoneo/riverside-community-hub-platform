const { createClient } = require("@supabase/supabase-js");
require("dotenv/config");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// Fixed UUIDs so FK relationships between tables are deterministic.
const UUIDS = {
  aisha: "11111111-1111-4111-8111-111111111111",
  david: "22222222-2222-4222-8222-222222222222",
  nandi: "33333333-3333-4333-8333-333333333333",
  staff: "44444444-4444-4444-8444-444444444444",
  admin: "55555555-5555-4555-8555-555555555555",
  prog1: "61111111-1111-4111-8111-111111111111",
  prog2: "62222222-2222-4222-8222-222222222222",
  prog3: "63333333-3333-4333-8333-333333333333",
  fac1: "71111111-1111-4111-8111-111111111111",
  fac2: "72222222-2222-4222-8222-222222222222",
  eq1: "73333333-3333-4333-8333-333333333333",
  eq2: "74444444-4444-4444-8444-444444444444",
  camp1: "81111111-1111-4111-8111-111111111111",
  don1: "91111111-1111-4111-8111-111111111111",
  don2: "92222222-2222-4222-8222-222222222222",
  notif1: "a1111111-1111-4111-8111-111111111111",
  bk1: "b1111111-1111-4111-8111-111111111111",
  bk2: "b2222222-2222-4222-8222-222222222222",
  bk3: "b3333333-3333-4333-8333-333333333333",
};

const PASSWORD = "Password123";

async function upsert(table, row, match) {
  if (match) {
    const { data, error } = await supabase.from(table).upsert(row, { onConflict: match }).select().single();
    if (error) throw new Error("upsert " + table + " failed: " + error.message);
    return data;
  }
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw new Error("insert " + table + " failed: " + error.message);
  return data;
}

(async () => {
  console.log("Seeding auth.users + profiles...");
  const members = [
    { id: UUIDS.aisha, email: "aisha@riverside.example", full_name: "Aisha M.", role: "member", phone: "+27 11 000 0001" },
    { id: UUIDS.david, email: "david@riverside.example", full_name: "David L.", role: "member", phone: "+27 11 000 0002" },
    { id: UUIDS.nandi, email: "nandi@riverside.example", full_name: "Nandi P.", role: "member", phone: "+27 11 000 0003" },
    { id: UUIDS.staff, email: "staff@riverside.example", full_name: "Riverside Staff", role: "staff", phone: "+27 11 000 0004" },
    { id: UUIDS.admin, email: "admin@riverside.example", full_name: "Riverside Admin", role: "admin", phone: "+27 11 000 0005" },
  ];

  for (const m of members) {
    let authErr = null;
    const { data: existing } = await supabase.auth.admin.getUserById(m.id);
    if (existing && existing.user) {
      const r = await supabase.auth.admin.updateUserById(m.id, {
        email: m.email, password: PASSWORD, email_confirm: true,
        user_metadata: { full_name: m.full_name },
      });
      authErr = r.error;
    } else {
      const r = await supabase.auth.admin.createUser({
        id: m.id, email: m.email, password: PASSWORD, email_confirm: true,
        user_metadata: { full_name: m.full_name },
      });
      authErr = r.error;
    }
    if (authErr) throw new Error("auth upsert " + m.email + ": " + authErr.message);
    await upsert("profiles", {
      id: m.id, full_name: m.full_name, phone: m.phone, role: m.role,
      membership_expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    }, "id");
  }
  console.log("  profiles done");

  console.log("Seeding programmes...");
  const programmes = [
    { id: UUIDS.prog1, title: "Youth Coding Club", age_range: "12-17", schedule_info: "Tuesdays, 4:00 PM", description: "Build digital skills with project-based learning and mentorship.", image_url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80" },
    { id: UUIDS.prog2, title: "Community Fitness", age_range: "18+", schedule_info: "Wednesdays, 6:00 PM", description: "Low-cost fitness sessions designed for community wellbeing.", image_url: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80" },
    { id: UUIDS.prog3, title: "Family Arts Workshop", age_range: "All ages", schedule_info: "Saturdays, 10:00 AM", description: "Hands-on creative sessions for families and caregivers.", image_url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80" },
  ];
  for (const p of programmes) {
    const { error } = await supabase.from("programmes").upsert(p, { onConflict: "id" });
    if (error) throw new Error("programme " + p.title + ": " + error.message);
  }
  console.log("  programmes done");

  console.log("Seeding facilities & equipment...");
  const facilities = [
    { id: UUIDS.fac1, name: "Boardroom A", capacity: 12, hourly_rate: 180, description: "Ideal for community meetings and executive sessions." },
    { id: UUIDS.fac2, name: "Community Hall", capacity: 50, hourly_rate: 420, description: "Spacious room for events and trainings." },
  ];
  const equipment = [
    { id: UUIDS.eq1, name: "Gym Equipment Set", quantity: 1, description: "Portable fitness equipment bundle for training sessions." },
    { id: UUIDS.eq2, name: "Projector Kit", quantity: 1, description: "Projector and screen package for presentations." },
  ];
  for (const f of facilities) {
    const { error } = await supabase.from("facilities").upsert(f, { onConflict: "id" });
    if (error) throw new Error("facility " + f.name + ": " + error.message);
  }
  for (const e of equipment) {
    const { error } = await supabase.from("equipment").upsert(e, { onConflict: "id" });
    if (error) throw new Error("equipment " + e.name + ": " + error.message);
  }
  console.log("  facilities/equipment done");

  console.log("Seeding campaign...");
  const { error: campErr } = await supabase.from("campaigns").upsert({
    id: UUIDS.camp1, title: "Winter Food Parcels", goal_amount: 50000, current_amount: 0,
    description: "Help Riverside support households with winter food parcels and essential groceries.",
  }, { onConflict: "id" });
  if (campErr) throw new Error("campaign: " + campErr.message);

  // Mock shows currentAmount = 28600. campaigns.current_amount is trigger-maintained
  // (apply_donation_to_campaign), so we insert two guest donations that sum to 28600.
  console.log("Seeding donations (guest, to reach campaign total 28600)...");
  const donations = [
    { id: UUIDS.don1, campaign_id: UUIDS.camp1, donor_id: null, type: "one_off", status: "pending_followup", amount: 20000, donor_name: "Community supporter", donor_email: "supporter@riverside.example", donor_phone: null, anonymous: false, receipt_opt_in: true, staff_note: null },
    { id: UUIDS.don2, campaign_id: UUIDS.camp1, donor_id: null, type: "one_off", status: "followed_up", amount: 8600, donor_name: "Anonymous donor", donor_email: null, donor_phone: null, anonymous: true, receipt_opt_in: false, staff_note: "Follow-up completed" },
  ];
  for (const d of donations) {
    const { error } = await supabase.from("donations").upsert(d, { onConflict: "id" });
    if (error) throw new Error("donation " + d.id + ": " + error.message);
  }
  console.log("  donations done");

  console.log("Seeding bookings...");
  const bookings = [
    { id: UUIDS.bk1, member_id: UUIDS.aisha, facility_id: UUIDS.fac1, equipment_id: null, start_at: "2026-09-18T16:00:00Z", end_at: "2026-09-18T18:00:00Z", status: "pending", staff_note: null },
    { id: UUIDS.bk2, member_id: UUIDS.david, facility_id: null, equipment_id: UUIDS.eq1, start_at: "2026-09-19T17:00:00Z", end_at: "2026-09-19T19:00:00Z", status: "approved", staff_note: "Approved for gym session" },
    { id: UUIDS.bk3, member_id: UUIDS.nandi, facility_id: UUIDS.fac2, equipment_id: null, start_at: "2026-09-21T10:00:00Z", end_at: "2026-09-21T16:00:00Z", status: "rejected", staff_note: "Hall booked for another event" },
  ];
  for (const b of bookings) {
    const { error } = await supabase.from("bookings").upsert(b, { onConflict: "id" });
    if (error) throw new Error("booking " + b.id + ": " + error.message);
  }
  console.log("  bookings done");

  console.log("Seeding notifications...");
  const notifications = [
    { id: UUIDS.notif1, user_id: UUIDS.aisha, booking_id: UUIDS.bk1, message: "Your booking request was rejected.", read: false },
  ];
  for (const n of notifications) {
    const { error } = await supabase.from("notifications").upsert(n, { onConflict: "id" });
    if (error) throw new Error("notification " + n.id + ": " + error.message);
  }
  console.log("  notifications done");

  console.log("\nSeed complete.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
