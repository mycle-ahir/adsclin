import { z } from 'zod';

export const proxySchemeSchema = z.enum(['http', 'https', 'socks5']);

export const fingerprintConfigSchema = z.object({
  seed: z.string().min(1),
  os: z.enum(['windows', 'macos', 'linux']),
  browserVersion: z.string().min(1),
  userAgent: z.string().min(1),
  uaMetadata: z.object({
    brands: z.array(z.object({ brand: z.string(), version: z.string() })),
    fullVersionList: z.array(z.object({ brand: z.string(), version: z.string() })).optional(),
    platform: z.string(),
    platformVersion: z.string(),
    architecture: z.string(),
    model: z.string(),
    mobile: z.boolean(),
    bitness: z.string().optional(),
  }),
  screen: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    dpr: z.number().positive(),
  }),
  hardwareConcurrency: z.number().int().min(1).max(128),
  deviceMemory: z.number().min(0.25).max(128),
  languages: z.array(z.string().min(2)),
  timezone: z.string().min(1),
  geolocation: z
    .object({
      lat: z.number(),
      lon: z.number(),
      accuracy: z.number().nonnegative(),
    })
    .optional(),
  webrtc: z.enum(['proxy-only', 'disabled', 'real']),
  canvas: z.enum(['noise', 'real']),
  webgl: z.object({
    vendor: z.string(),
    renderer: z.string(),
    noise: z.boolean(),
  }),
  audio: z.enum(['noise', 'real']),
  fonts: z.array(z.string()),
  mediaDevices: z.object({
    audioIn: z.number().int().nonnegative(),
    audioOut: z.number().int().nonnegative(),
    videoIn: z.number().int().nonnegative(),
  }),
});

export const createProfileSchema = z.object({
  name: z.string().min(1).max(200),
  groupId: z.string().uuid().nullable().optional(),
  proxyId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).optional().default(''),
  tags: z.array(z.string().min(1).max(100)).optional().default([]),
  fingerprint: fingerprintConfigSchema.nullable().optional(),
  extensions: z.array(z.string()).optional(),
});
export type CreateProfileInput = z.infer<typeof createProfileSchema>;

export const updateProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  groupId: z.string().uuid().nullable().optional(),
  proxyId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
  fingerprint: fingerprintConfigSchema.nullable().optional(),
  extensions: z.array(z.string()).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const createProxySchema = z.object({
  name: z.string().min(1).max(200),
  scheme: proxySchemeSchema,
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
});
export type CreateProxyInput = z.infer<typeof createProxySchema>;

export const updateProxySchema = createProxySchema.partial().extend({
  id: z.string().uuid(),
});
export type UpdateProxyInput = z.infer<typeof updateProxySchema>;

export const createGroupSchema = z.object({
  name: z.string().min(1).max(200),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateSettingsSchema = z.object({
  customExecutablePath: z.string().nullable().optional(),
  apiPort: z.number().int().min(1024).max(65535).optional(),
  apiToken: z.string().min(8).optional(),
  apiEnabled: z.boolean().optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const cookieFormatSchema = z.enum(['json', 'netscape']);

export const exportCookiesSchema = z.object({
  profileId: z.string().uuid(),
  format: cookieFormatSchema.default('json'),
});
export type ExportCookiesInput = z.infer<typeof exportCookiesSchema>;

export const importCookiesSchema = z.object({
  profileId: z.string().uuid(),
  content: z.string().min(1),
  format: cookieFormatSchema.default('json'),
});
export type ImportCookiesInput = z.infer<typeof importCookiesSchema>;

export const proxyAssignmentModeSchema = z.enum(['none', 'sequential', 'random', 'specific']);

export const bulkCreateProfilesSchema = z.object({
  count: z.number().int().min(1).max(100),
  namePrefix: z.string().min(1).max(150),
  templateId: z.string().optional(),
  groupId: z.string().uuid().nullable().optional(),
  proxyMode: proxyAssignmentModeSchema.default('none'),
  specificProxyId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().min(1).max(100)).optional().default([]),
});
export type BulkCreateProfilesInput = z.infer<typeof bulkCreateProfilesSchema>;

export const bulkCreateProxiesSchema = z.object({
  proxies: z.array(createProxySchema).min(1).max(500),
});
export type BulkCreateProxiesInput = z.infer<typeof bulkCreateProxiesSchema>;

export const launchGroupSchema = z.object({
  groupId: z.string().uuid(),
  tile: z.boolean().optional().default(false),
});
export type LaunchGroupInput = z.infer<typeof launchGroupSchema>;

export const stopGroupSchema = z.object({
  groupId: z.string().uuid(),
});
export type StopGroupInput = z.infer<typeof stopGroupSchema>;



