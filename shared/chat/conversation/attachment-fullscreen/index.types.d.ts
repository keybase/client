import {MessageAttachment} from '../../../constants/types/chat2'
export type Props = {
  path: string
  title: string
  isZoomed: boolean
  message: MessageAttachment
  progress: number
  progressLabel: string | null
  onClose: () => void
  onDownloadAttachment: () => void | null
  onShowInFinder: () => void | null
  onToggleZoom: () => void
  isVideo: boolean
  autoPlay: boolean
}
