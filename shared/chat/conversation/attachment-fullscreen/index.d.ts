import * as React from 'react'
import {MessageAttachment} from '../../../constants/types/chat2'
export type Props = {
  path: string
  previewHeight: number
  previewWidth: number
  title: string
  message: MessageAttachment
  progress: number
  progressLabel?: string
  onAllMedia: () => void
  onNextAttachment: () => void
  onPreviousAttachment: () => void
  onClose: () => void
  onDownloadAttachment?: () => void
  onShowInFinder?: () => void
  isVideo: boolean
}
export default class Fullscreen extends React.Component<Props> {}
