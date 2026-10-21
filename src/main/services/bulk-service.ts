/**
 * Bulk operations service for ProfileBrowser.
 *
 * Requirements (SPEC.md §8):
 *  - Bulk create N profiles from a template with unique seeds.
 *  - Paste a list of proxies in standard formats and bulk create with auto-assignment.
 */

import * as crypto from 'crypto';
import type { Profile, Proxy } from '../../shared/types';
import type { CreateProxyInput, BulkCreateProfilesInput } from '../../shared/schemas';
import * as profileService from './profile-service';
import * as proxyService from './proxy-service';
import { generateFingerprint } from './fingerprint-generator';

export { parseProxyList } from '../../shared/proxy-parser';

/**
 * Bulk creates proxies in the database with safeStorage encrypted passwords.
 */
export function bulkCreateProxies(proxies: CreateProxyInput[]): Proxy[] {
  const created: Proxy[] = [];
  for (const p of proxies) {
    const item = proxyService.createProxy(p);
    created.push(item);
  }
  return created;
}

/**
 * Bulk creates N profiles with unique seeds generated from the specified template,
 * and auto-assigns proxies according to the chosen proxy mode.
 */
export function bulkCreateProfiles(input: BulkCreateProfilesInput): Profile[] {
  const allProxies = proxyService.listProxies();
  const created: Profile[] = [];

  for (let i = 1; i <= input.count; i++) {
    const profileName = `${input.namePrefix} ${i}`;

    let assignedProxyId: string | null = null;
    if (input.proxyMode === 'specific' && input.specificProxyId) {
      assignedProxyId = input.specificProxyId;
    } else if (input.proxyMode === 'sequential' && allProxies.length > 0) {
      assignedProxyId = allProxies[(i - 1) % allProxies.length].id;
    } else if (input.proxyMode === 'random' && allProxies.length > 0) {
      const idx = Math.floor(Math.random() * allProxies.length);
      assignedProxyId = allProxies[idx].id;
    }

    // Generate unique seeded fingerprint per profile
    const fingerprint = generateFingerprint({
      ...(input.templateId ? { templateId: input.templateId } : {}),
      seed: crypto.randomUUID(),
    });

    const profile = profileService.createProfile({
      name: profileName,
      groupId: input.groupId ?? null,
      proxyId: assignedProxyId,
      notes: `Bulk created profile #${i}`,
      tags: input.tags ?? [],
      fingerprint,
    });

    created.push(profile);
  }

  return created;
}
