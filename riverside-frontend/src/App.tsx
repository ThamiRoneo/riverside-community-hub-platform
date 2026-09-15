import { Routes, Route } from 'react-router-dom';

// Route map to be implemented (see wireframes):
//   /                 landing (programmes card, campaigns, donate CTA)
//   /donate           public donation form
//   /login /register  auth
//   /member/*         member: profile, bookings, expiring-membership flag
//   /staff/*          staff: booking approvals (note mandatory on reject),
//                     donation records + follow-up state
//   /admin/*          admin: programmes, campaigns, reports, staff mgmt
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<h1>Riverside Community Hub</h1>} />
    </Routes>
  );
}
