import type {VideoEdit} from '@/util/media-process'

type Props = {
  edit?: VideoEdit
  onEdit: (edit: VideoEdit) => void
  path: string
}

// Trimming is iOS-only (the export lives in MediaUtils), so callers gate on
// canEdit and this never renders.
const AttachmentTrim = (_: Props) => null

export default AttachmentTrim
