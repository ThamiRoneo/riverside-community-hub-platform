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
  don3: "93333333-3333-4333-8333-333333333333",
  don4: "94444444-4444-4444-8444-444444444444",
  notif1: "a1111111-1111-4111-8111-111111111111",
  bk1: "b1111111-1111-4111-8111-111111111111",
  bk2: "b2222222-2222-4222-8222-222222222222",
  bk3: "b3333333-3333-4333-8333-333333333333",
  notif2: "a2222222-2222-4222-8222-222222222222",
};

const PASSWORD = "Password123";

/**
 * Bookings are placed relative to the run date, not hard-coded. Fixed calendar
 * dates rot: they were already in the past, which left the staff approval queue
 * empty and the current-month report window with nothing in it.
 */
function day(offsetDays, hour) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

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
    { id: UUIDS.aisha, email: "aisha@riverside.example", full_name: "Aisha M.", role: "member", phone: "+27 11 000 0001", membership_tier: "free" },
    { id: UUIDS.david, email: "david@riverside.example", full_name: "David L.", role: "member", phone: "+27 11 000 0002", membership_tier: "free" },
    { id: UUIDS.nandi, email: "nandi@riverside.example", full_name: "Nandi P.", role: "member", phone: "+27 11 000 0003", membership_tier: "free" },
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
      // Stated explicitly rather than left to the column default, the same way
      // role is: the auth, profile and members routes all read this column.
      membership_tier: "free",
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
    { id: UUIDS.eq1, name: "Gym Equipment Set", quantity: 1, capacity: 12, description: "Portable fitness equipment bundle for training sessions." },
    { id: UUIDS.eq2, name: "Projector Kit", quantity: 1, capacity: 1, description: "Projector and screen package for presentations." },
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
  // current_amount is trigger-maintained (apply_donation_to_campaign). Writing it
  // here fights the trigger and would zero the total on a re-run.
  const { error: campErr } = await supabase.from("campaigns").upsert({
    id: UUIDS.camp1, title: "Winter Food Parcels", goal_amount: 50000,
    description: "Help Riverside support households with winter food parcels and essential groceries.",
  }, { onConflict: "id" });
  if (campErr) throw new Error("campaign: " + campErr.message);

  // Contract section 3: one_off settles as "paid" immediately, pledge_intent is a
  // promise to give and lands in the staff follow-up queue, and the only valid step
  // out of the queue is pending_followup -> followed_up. These four rows cover both
  // types and all four contract statuses, and never pair one_off with
  // pending_followup, which the API cannot produce.
  const YEAR = new Date().getUTCFullYear();
  const donations = [
    { id: UUIDS.don1, campaign_id: UUIDS.camp1, donor_id: null, type: "one_off", status: "paid", amount: 20000, donor_name: "Community supporter", donor_email: "supporter@riverside.example", donor_phone: null, anonymous: false, receipt_opt_in: true, staff_note: null, receipt_reference: `RCH-${YEAR}-A1B2C3D4` },
    { id: UUIDS.don2, campaign_id: UUIDS.camp1, donor_id: null, type: "pledge_intent", status: "pending_followup", amount: 5850, donor_name: "Thandi K.", donor_email: "thandi@riverside.example", donor_phone: "+27 11 000 0016", anonymous: false, receipt_opt_in: true, staff_note: null, receipt_reference: `RCH-${YEAR}-B2C3D4E5` },
    { id: UUIDS.don3, campaign_id: UUIDS.camp1, donor_id: null, type: "pledge_intent", status: "followed_up", amount: 8600, donor_name: "Anonymous donor", donor_email: null, donor_phone: null, anonymous: true, receipt_opt_in: false, staff_note: "Follow-up completed", receipt_reference: `RCH-${YEAR}-C3D4E5F6` },
    { id: UUIDS.don4, campaign_id: UUIDS.camp1, donor_id: null, type: "pledge_intent", status: "cancelled", amount: 1500, donor_name: "Withdrawn supporter", donor_email: "withdrawn@riverside.example", donor_phone: null, anonymous: false, receipt_opt_in: false, staff_note: "Donor withdrew the pledge", receipt_reference: `RCH-${YEAR}-D4E5F6A7` },
  ];
  // campaigns.current_amount is the trigger's sum, and a cancelled donation is
  // withdrawn money that the trigger never counts, so don4 is excluded here too.
  const donationTotal = donations
    .filter((d) => d.status !== "cancelled")
    .reduce((sum, d) => sum + d.amount, 0);

  // Remove this seed's own rows before re-inserting. The DELETE branch of
  // apply_donation_to_campaign subtracts whatever is still counting, so a re-run
  // recomputes the total from scratch instead of leaving the campaign at whatever
  // it already held. Scoped to these ids; donations from outside this seed are
  // untouched.
  const { error: delErr } = await supabase
    .from("donations")
    .delete()
    .in("id", donations.map((d) => d.id));
  if (delErr) throw new Error("donation cleanup failed: " + delErr.message);

  console.log(`Seeding donations (guest, campaign total ${donationTotal})...`);
  for (const d of donations) {
    const { error } = await supabase.from("donations").upsert(d, { onConflict: "id" });
    if (error) throw new Error("donation " + d.id + ": " + error.message);
  }
  console.log("  donations done");

  console.log("Seeding bookings...");
  // purpose, people_count and contact_phone are the contract's booking fields,
  // added in migration 0008. Phones match the members they belong to.
  const bookings = [
    { id: UUIDS.bk1, member_id: UUIDS.aisha, facility_id: UUIDS.fac1, equipment_id: null, start_at: day(7, 16), end_at: day(7, 18), status: "pending", staff_note: null, purpose: "Neighbourhood association meeting", accessibility_notes: null, contact_phone: "0721000001", people_count: 10 },
    { id: UUIDS.bk2, member_id: UUIDS.david, facility_id: null, equipment_id: UUIDS.eq1, start_at: day(10, 17), end_at: day(10, 19), status: "approved", staff_note: "Approved for gym session", purpose: "Youth fitness coaching", accessibility_notes: null, contact_phone: "0721000002", people_count: 6 },
    { id: UUIDS.bk3, member_id: UUIDS.nandi, facility_id: UUIDS.fac2, equipment_id: null, start_at: day(14, 10), end_at: day(14, 16), status: "rejected", staff_note: "Hall booked for another event", purpose: "Community food drive", accessibility_notes: "Step-free access needed for the loading area", contact_phone: "0721000003", people_count: 25 },
  ];
  for (const b of bookings) {
    const { error } = await supabase.from("bookings").upsert(b, { onConflict: "id" });
    if (error) throw new Error("booking " + b.id + ": " + error.message);
  }
  console.log("  bookings done");

  // The wording is copied from the messages bookings.routes.ts actually writes
  // on approve and reject, and each notification belongs to the member who made
  // the booking it refers to. One unread and one read, so the read flag is
  // represented in both states.
  console.log("Seeding notifications...");
  const notifications = [
    { id: UUIDS.notif1, user_id: UUIDS.nandi, booking_id: UUIDS.bk3, message: "Your booking request was rejected.", read: false },
    { id: UUIDS.notif2, user_id: UUIDS.david, booking_id: UUIDS.bk2, message: "Your booking request was approved.", read: true },
  ];
  for (const n of notifications) {
    const { error } = await supabase.from("notifications").upsert(n, { onConflict: "id" });
    if (error) throw new Error("notification " + n.id + ": " + error.message);
  }
  console.log("  notifications done");

  console.log("\nSeed complete.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });