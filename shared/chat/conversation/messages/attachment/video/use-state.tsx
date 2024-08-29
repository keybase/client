import * as C from '@/constants'
import * as React from 'react'
import {OrdinalContext} from '@/chat/conversation/messages/ids-context'
import {missingMessage, maxWidth, maxHeight} from '../shared'

export const useState = () => {
  const ordinal = React.useContext(OrdinalContext)
  return C.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      const message = m?.type === 'attachment' ? m : missingMessage
      const {previewURL, previewHeight, previewWidth} = message
      const {fileURL, downloadPath, transferState, videoDuration} = message
      const {height, width} = C.Chat.clampImageSize(previewWidth, previewHeight, maxWidth, maxHeight)
      return {downloadPath, height, previewURL, transferState, url: fileURL, videoDuration, width}
    })
  )
}
