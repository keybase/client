import type * as T from '@/constants/types'

export type Props = {
  openFullscreen?: () => void
  showPopup?: () => void
  allowPlay: boolean
  message: T.Chat.MessageAttachment
}
