import * as C from '@/constants'
import * as React from 'react'
import {OrdinalContext} from '@/chat/conversation/messages/ids-context'
import {maxWidth, maxHeight} from '../shared'

const missingMessage = C.Chat.makeMessageAttachment()

export const useState = () => {
  const ordinal = React.useContext(OrdinalContext)
  return C.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      const message = m?.type === 'attachment' ? m : missingMessage
      const {fileURL, previewHeight, previewWidth} = message
      let {previewURL} = message
      let {height, width} = C.Chat.clampImageSize(previewWidth, previewHeight, maxWidth, maxHeight)
      // This is mostly a sanity check and also allows us to handle HEIC even though the go side doesn't
      // understand
      if (height === 0 || width === 0) {
        height = 320
        width = 320
      }
      if (!previewURL) {
        previewURL = fileURL
      }
      return {height, previewURL, width}
    })
  )
}
