import express from "express";
import cors from "cors";
import errorHandler from "@/middlewares/errorHandler";
import cookieParser from 'cookie-parser';
import { attachSupabase } from "@/middlewares/supabaseClient";

export const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:8888',
  credentials: true,
  exposedHeaders: ['x-access-token'] 
}));
app.use(express.json());

app.use(cookieParser());

app.use(attachSupabase);

// All routes above...
import teamsRouter from "@/routes/teams.routes";
import authRouter from '@/routes/auth.routes';
import teamMemberRouter from '@/routes/teamMembers.routes';
import teamInvitationRouter from '@/routes/teamInvitations.routes';
import hubspotRouter from '@/routes/hubspot.routes';
import { protectRoutes } from "./middlewares/protectRoutes";

// 🆓 Public auth route
app.use('/api/team-invitations', teamInvitationRouter);
app.use('/api', authRouter);

// 🔐 Attach protected routes
protectRoutes(app, '/api/teams', teamsRouter);
protectRoutes(app, '/api/team-members', teamMemberRouter);
protectRoutes(app, '/api', hubspotRouter);

// Catch-all for unhandled routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found',
  });
})


// Global error handler goes last
app.use(errorHandler);

