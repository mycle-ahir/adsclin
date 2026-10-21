import { create } from 'zustand';
import type { Profile, Group } from '../../shared/types';
import type { CreateProfileInput, UpdateProfileInput } from '../../shared/schemas';

interface ProfilesState {
  profiles: Profile[];
  groups: Group[];
  loading: boolean;
  error: string | null;
  // actions
  fetchProfiles: () => Promise<void>;
  fetchGroups: () => Promise<void>;
  createProfile: (input: CreateProfileInput) => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  duplicateProfile: (id: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  launchProfile: (id: string) => Promise<void>;
  stopProfile: (id: string) => Promise<void>;
  bulkLaunch: (ids: string[]) => Promise<void>;
  bulkStop: (ids: string[]) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  clearError: () => void;
  // called by IPC push event listener
  applyStatusChange: (profileId: string, status: string) => void;
}

export const useProfilesStore = create<ProfilesState>((set, get) => ({
  profiles: [],
  groups: [],
  loading: false,
  error: null,

  fetchProfiles: async () => {
    set({ loading: true, error: null });
    try {
      let profiles = await window.api.listProfiles();
      if (profiles.length === 0 && window.api.seedDemoProfiles) {
        await window.api.seedDemoProfiles(true);
        profiles = await window.api.listProfiles();
      }
      set({ profiles, loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  fetchGroups: async () => {
    try {
      const groups = await window.api.listGroups();
      set({ groups });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  createProfile: async (input) => {
    const profile = await window.api.createProfile(input);
    set((s) => ({ profiles: [profile, ...s.profiles] }));
  },

  updateProfile: async (input) => {
    const updated = await window.api.updateProfile(input);
    set((s) => ({
      profiles: s.profiles.map((p) => (p.id === updated.id ? updated : p)),
    }));
  },

  duplicateProfile: async (id) => {
    try {
      const cloned = await window.api.duplicateProfile(id);
      set((s) => ({ profiles: [cloned, ...s.profiles] }));
    } catch (err) {
      set({ error: `Failed to duplicate profile: ${String(err)}` });
    }
  },

  deleteProfile: async (id) => {
    await window.api.deleteProfile(id);
    set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
  },

  launchProfile: async (id) => {
    set((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === id ? { ...p, status: 'running' as const } : p
      ),
    }));
    try {
      await window.api.launchProfile(id);
    } catch (err) {
      set((s) => ({
        profiles: s.profiles.map((p) =>
          p.id === id ? { ...p, status: 'idle' as const } : p
        ),
        error: `Launch failed: ${String(err)}`,
      }));
    }
  },

  stopProfile: async (id) => {
    await window.api.stopProfile(id).catch((err: unknown) => {
      set({ error: `Stop failed: ${String(err)}` });
    });
  },

  bulkLaunch: async (ids) => {
    const idleIds = ids.filter((id) => {
      const p = get().profiles.find((prof) => prof.id === id);
      return p && p.status !== 'running';
    });
    for (const id of idleIds) {
      await get().launchProfile(id);
    }
  },

  bulkStop: async (ids) => {
    const runningIds = ids.filter((id) => {
      const p = get().profiles.find((prof) => prof.id === id);
      return p && p.status === 'running';
    });
    for (const id of runningIds) {
      await get().stopProfile(id);
    }
  },

  bulkDelete: async (ids) => {
    for (const id of ids) {
      await get().deleteProfile(id);
    }
  },

  clearError: () => set({ error: null }),

  applyStatusChange: (profileId, status) => {
    set((s) => ({
      profiles: s.profiles.map((p) =>
        p.id === profileId ? { ...p, status: status as Profile['status'] } : p
      ),
    }));
  },
}));
