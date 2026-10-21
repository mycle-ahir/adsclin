import { ProfileEditorModal } from './ProfileEditorModal';

interface CreateProfileDialogProps {
  onClose: () => void;
}

export function CreateProfileDialog({ onClose }: CreateProfileDialogProps) {
  return <ProfileEditorModal mode="create" onClose={onClose} />;
}
