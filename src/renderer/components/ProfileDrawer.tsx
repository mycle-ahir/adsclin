import type { Profile } from '../../shared/types';
import { ProfileEditorModal } from './ProfileEditorModal';

interface ProfileDrawerProps {
  profile: Profile;
  onClose: () => void;
}

export function ProfileDrawer({ profile, onClose }: ProfileDrawerProps) {
  return <ProfileEditorModal mode="edit" profile={profile} onClose={onClose} />;
}
