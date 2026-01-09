import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'
import {missingMessage, maxWidth, maxHeight} from '../shared'

export const useState = () => {
  const ordinal = useOrdinal()
  return Chat.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      const message = m?.type === 'attachment' ? m : missingMessage
      const {previewURL, previewHeight, previewWidth} = message
      const {fileURL, downloadPath, transferState, videoDuration} = message
      const {height, width} = Chat.clampImageSize(previewWidth, previewHeight, maxWidth, maxHeight)
      return {downloadPath, height, previewURL, transferState, url: fileURL, videoDuration, width}
    })
  )
}
