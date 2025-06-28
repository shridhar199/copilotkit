import express from "express";
import cors from 'cors';
import { logRequestResponse } from "./middlewares/logger";
import {
  copilotRuntimeNodeHttpEndpoint,
} from '@copilotkit/runtime';
import { runtime, serviceAdapter } from "./utils/CopilotActions";

const app = express();
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));


// Handle preflight requests for all routes
app.options("*", cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
// Simple logging middleware to log requests and responses data
app.use(logRequestResponse);

// app.use("/api/v1/copilotkit", copilotRoutes)

app.use('/api/v1/copilotkit', (req, res, next) => {
  (async () => {
    // const runtime = new CopilotRuntime();
    const handler = copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilotkit',
      runtime,
      serviceAdapter,
    });
 
    return handler(req, res);
  })().catch(next);
});
// app.use(errorHandler);

export default app;
