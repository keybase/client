import {MessageAttachment} from '../../../constants/types/chat2'
export type Props = {
  path: string
  title: string
  message: MessageAttachment
  onClose: () => void
}
