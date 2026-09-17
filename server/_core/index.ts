import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { runFinancialSync } from "../financialSync";
import { captureHealthSnapshot } from "../healthSnapshot";
import { scheduledJiraReconciliationHandler } from "../jiraReconciliationSchedule";
import { scheduledRecurringServicesJsmHandler } from "../recurringServicesJsmRefreshRunner";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Heartbeat: sincronización financiera programada (sólo cron autenticado)
  app.post("/api/scheduled/syncFinancial", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ status: "error", error: "Sólo tareas programadas pueden invocar este endpoint" });
        return;
      }
      const outcome = await runFinancialSync();
      console.log(
        `[FinancialSync] applied: ${outcome.inputDeals} deals (${outcome.insert} insert, ${outcome.update} update)`
      );
      res.status(200).json(outcome);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[FinancialSync] error:", message);
      res.status(500).json({ status: "error", error: message });
    }
  });
  // Heartbeat: captura diaria de snapshot de salud por proyecto (sólo cron autenticado)
  app.post("/api/scheduled/captureHealthSnapshot", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron) {
        res.status(403).json({ status: "error", error: "Sólo tareas programadas pueden invocar este endpoint" });
        return;
      }
      const outcome = await captureHealthSnapshot();
      console.log(
        `[HealthSnapshot] captured: ${outcome.projects} projects, ${outcome.snapshots} snapshots`
      );
      res.status(200).json(outcome);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[HealthSnapshot] error:", message);
      res.status(500).json({ status: "error", error: message });
    }
  });
  // Heartbeat: conciliación Jira diaria para proyectos homologados ready.
  app.post("/api/scheduled/syncJiraHomologated", scheduledJiraReconciliationHandler);
  // Heartbeat: actualización diaria GET-only de snapshots JSM/SLA para servicios recurrentes.
  app.post("/api/scheduled/refreshRecurringServicesJsm", scheduledRecurringServicesJsmHandler);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
