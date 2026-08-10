import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  fileName: z.string().max(200),
  fileBase64: z.string().min(10),
  usarIA: z.boolean().default(true),
});

export const auditarApoliceAnp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { runAnpAudit } = await import("./anp-audit.server");
    const binary = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    return runAnpAudit(binary, data.fileName, data.usarIA);
  });
