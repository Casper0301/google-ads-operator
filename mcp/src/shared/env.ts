import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_SCHEMA: z.string().default('public'),
  GOOGLE_ADS_MCP_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'must be 32-byte hex (generate with: openssl rand -hex 32)'),

  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().min(1),
  GOOGLE_ADS_CLIENT_ID: z.string().min(1),
  GOOGLE_ADS_CLIENT_SECRET: z.string().min(1),
  GOOGLE_ADS_MCC_ID: z.string().optional(),
  GOOGLE_ADS_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:5432/oauth/google/callback'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
