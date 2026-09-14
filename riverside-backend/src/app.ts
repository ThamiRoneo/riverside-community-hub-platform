import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import membersRoutes from "./routes/members.routes";
import bookingsRoutes from "./routes/bookings.routes";
import donationsRoutes from "./routes/donations.routes";
import facilitiesRoutes from "./routes/facilities.routes";
import equipmentRoutes from "./routes/equipment.routes";
import campaignsRoutes from "./routes/campaigns.routes";
import programmesRoutes from "./routes/programmes.routes";
import reportsRoutes from "./routes/reports.routes";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/donations", donationsRoutes);
app.use("/api/facilities", facilitiesRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/programmes", programmesRoutes);
app.use("/api/reports", reportsRoutes);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;
