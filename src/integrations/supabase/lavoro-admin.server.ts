// Server-only admin client for the connected external Supabase project.
// Uses LAVORO_SUPABASE_SERVICE_ROLE_KEY (managed via the secrets tool).
// The `.server.ts` extension keeps this out of the client bundle.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createLavoroAdminClient() {
  const url =
    process.env.VITE_SUPABASE_URL ??
    "https://primmycdkkiziyhqkkkv.supabase.co";
  const serviceKey = process.env.LAVORO_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "LAVORO_SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione a service_role key nos secrets do projeto.",
    );
  }
  return createClient<Database>(url, serviceKey, {
    global: { fetch: createSupabaseFetch(serviceKey) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _client: ReturnType<typeof createLavoroAdminClient> | undefined;

export const lavoroAdmin = new Proxy({} as ReturnType<typeof createLavoroAdminClient>, {
  get(_, prop, receiver) {
    if (!_client) _client = createLavoroAdminClient();
    return Reflect.get(_client, prop, receiver);
  },
});
