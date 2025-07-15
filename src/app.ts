import express from "express";
import cors from "cors";
import errorHandler from "@/middlewares/errorHandler";
import { attachSupabase } from "@/middlewares/supabaseClient";

export const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:8888',
  credentials: true
}));
app.use(express.json());

app.use(attachSupabase);

// All routes above...
import teamsRouter from "@/routes/teams.routes";
import authRouter from '@/routes/auth.routes';
import teamMemberRouter from '@/routes/teamMembers.routes';

app.use('/api/teams', teamsRouter);
app.use('/api/team-members', teamMemberRouter);

app.use('/api', authRouter);

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

