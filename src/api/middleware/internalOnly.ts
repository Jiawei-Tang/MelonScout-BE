import type { MiddlewareHandler } from "hono";
import { resolveEnv } from "../../config";

type InternalOnlyOptions = {
  /**
   * Env var name containing the shared internal key.
   * Defaults to INTERNAL_API_KEY.
   */
  envName?: string;
  /**
   * Request header carrying the internal key.
   * Defaults to X-Internal-Key.
   */
  headerName?: string;
};

export function internalOnly(opts: InternalOnlyOptions = {}): MiddlewareHandler {
  const envName = opts.envName ?? "INTERNAL_API_KEY";
  const headerName = opts.headerName ?? "X-Internal-Key";

  return async (c, next) => {
    const key = resolveEnv(envName);
    if (!key) {
      return c.json({ error: `Internal API not configured (set ${envName})` }, 503);
    }

    const provided = c.req.header(headerName)?.trim();
    if (provided !== key) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await next();
  };
}

