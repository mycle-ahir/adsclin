import { useState, useEffect } from 'react';
import type { Profile, Proxy } from '../../shared/types';
import type { UpdateProfileInput } from '../../shared/schemas';
import { useProfilesStore } from '../stores/profiles-store';

interface EditProfileDialogProps {
  profile: Profile;
  onClose: () => void;
}

export function EditProfileDialog({ profile, onClose }: EditProfileDialogProps) {
  const updateProfile = useProfilesStore((s) => s.updateProfile);

  const [name, setName] = useState(profile.name);
  const [notes, setNotes] = useState(profile.notes);
  const [proxyId, setProxyId] = useState<string>(profile.proxyId ?? '');
  const [tagsRaw, setTagsRaw] = useState(profile.tags.join(', '));
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [nameError, setNameError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Lock body scroll
  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, []);

  // Fetch proxies for the selector
  useEffect(() => {
    window.api
      .listProxies()
      .then(setProxies)
      .catch((err: unknown) => {
        console.error('Failed to load proxies', err);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNameError('');
    setSubmitError('');

    if (name.trim().length === 0) {
      setNameError('Name is required.');
      return;
    }

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const input: UpdateProfileInput = {
      id: profile.id,
      name: name.trim(),
      notes,
      proxyId: proxyId !== '' ? proxyId : null,
      tags,
    };

    setSubmitting(true);
    try {
      await updateProfile(input);
      onClose();
    } catch (err) {
      setSubmitError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 ${
                nameError ? 'border-red-400' : 'border-gray-300'
              }`}
              placeholder="Profile name"
              autoFocus
            />
            {nameError && (
              <p className="mt-1 text-xs text-red-600">{nameError}</p>
            )}
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              placeholder="Optional notes…"
            />
          </div>

          {/* Proxy selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proxy
            </label>
            <select
              value={proxyId}
              onChange={(e) => setProxyId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            >
              <option value="">— No proxy —</option>
              {proxies.map((px) => (
                <option key={px.id} value={px.id}>
                  {px.name} ({px.scheme}://{px.host}:{px.port})
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
              <span className="ml-1 text-xs text-gray-400">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="e.g. social, work, test"
            />
          </div>

          {submitError && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {submitError}
            </p>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
