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
      const vertical = previewHeight > previewWidth
      // the native av controls on ios actually clip themselves if the width is too small so give
      // some extra room in this case
      const extra = C.isIOS && vertical ? 75 : 0
      const {height, width} = C.Chat.clampImageSize(
        previewWidth,
        previewHeight,
        maxWidth + extra,
        maxHeight + extra
      )
      return {downloadPath, height, previewURL, transferState, url: fileURL, videoDuration, width}
    })
  )
}
