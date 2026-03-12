import { mkdirSync, appendFileSync, existsSync } from "fs";
import { join } from "path";
import { appConfig, resolveEnv } from "../config";

type LogLevel = "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = { info: 0, warn: 1, error: 2 };

function getLogDir(): string {
  const envOverride = appConfig.logging.dirEnv
    ? resolveEnv(appConfig.logging.dirEnv)
    : undefined;
  return envOverride || appConfig.logging.dir;
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function timestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, args: unknown[]): string {
  const parts = args.map((a) =>
    typeof a === "string" ? a : a instanceof Error ? a.stack ?? a.message : JSON.stringify(a),
  );
  return `[${timestamp()}] [${level.toUpperCase()}] ${parts.join(" ")}`;
}

class Logger {
  private logDir: string;
  private minLevel: number;
  private initialized = false;

  constructor() {
    this.logDir = getLogDir();
    this.minLevel = LEVEL_PRIORITY[appConfig.logging.level as LogLevel] ?? 0;
  }

  private ensureDir() {
    if (this.initialized) return;
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }
      this.initialized = true;
      console.log(`📝 Logs → ${this.logDir}`);
    } catch (err) {
      console.error(`⚠️ Failed to create log dir ${this.logDir}, falling back to ./logs`);
      this.logDir = "./logs";
      mkdirSync(this.logDir, { recursive: true });
      this.initialized = true;
    }
  }

  private writeToFile(level: LogLevel, line: string) {
    this.ensureDir();
    const date = todayDateStr();
    const allLog = join(this.logDir, `${date}.log`);
    appendFileSync(allLog, line + "\n");

    if (level === "error") {
      const errorLog = join(this.logDir, `error-${date}.log`);
      appendFileSync(errorLog, line + "\n");
    }
  }

  info(...args: unknown[]) {
    if (this.minLevel > LEVEL_PRIORITY.info) return;
    const line = formatMessage("info", args);
    console.log(...args);
    this.writeToFile("info", line);
  }

  warn(...args: unknown[]) {
    if (this.minLevel > LEVEL_PRIORITY.warn) return;
    const line = formatMessage("warn", args);
    console.warn(...args);
    this.writeToFile("warn", line);
  }

  error(...args: unknown[]) {
    const line = formatMessage("error", args);
    console.error(...args);
    this.writeToFile("error", line);
  }
}

export const logger = new Logger();

export function patchConsole() {
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    origLog(...args);
    try {
      logger["writeToFile"]("info", formatMessage("info", args));
    } catch {}
  };

  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    try {
      logger["writeToFile"]("warn", formatMessage("warn", args));
    } catch {}
  };

  console.error = (...args: unknown[]) => {
    origError(...args);
    try {
      logger["writeToFile"]("error", formatMessage("error", args));
    } catch {}
  };
}
