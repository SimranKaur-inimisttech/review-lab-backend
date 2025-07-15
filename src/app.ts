import express from "express";
import cors from "cors";
import errorHandler from "./middlewares/errorHandler.js";
import { attachSupabase } from "./middlewares/supabaseClient.js";

export const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:8888',
  credentials: true
}));
app.use(express.json());

app.use(attachSupabase);

// All routes above...
import teamsRouter from "./routes/teams.routes.js";
import authRouter from './routes/auth.routes.js';
import teamMemberRouter from './routes/teamMembers.routes.js';

app.use('/api/teams', teamsRouter);
app.use('/api/team-members', teamMemberRouter);

app.use('/api', authRouter);

// Catch-all for unhandled routes (optional)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Route not found',
  });
})


// Global error handler goes last
app.use(errorHandler);

