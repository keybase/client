import * as React from 'react'
import {MessageAttachment} from '../../../constants/types/chat2'
export type Props = {
  path: string
  previewHeight: number
  previewWidth: number
  title: string
  message: MessageAttachment
  progress: number
  progressLabel: string | null
  onNextAttachment: () => void
  onPreviousAttachment: () => void
  onClose: () => void
  onDownloadAttachment: (() => void) | null
  onShowInFinder: (() => void) | null
  isVideo: boolean
  autoPlay: boolean
}
export default class Fullscreen extends React.Component<Props> {}
