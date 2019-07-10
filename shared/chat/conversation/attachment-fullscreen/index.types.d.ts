import {MessageAttachment} from '../../../constants/types/chat2'
export type Props = {
  path: string
  title: string
  message: MessageAttachment
  progress: number
  progressLabel: string | null
  onClose: () => void
  onDownloadAttachment: (() => void) | null
  onShowInFinder: (() => void) | null
  isVideo: boolean
  autoPlay: boolean
}
