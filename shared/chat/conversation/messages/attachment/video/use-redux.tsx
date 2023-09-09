import * as C from '../../../../../constants'
import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import {OrdinalContext} from '../../ids-context'
import {missingMessage, maxWidth, maxHeight} from '../shared'

export const useRedux = () => {
  const ordinal = React.useContext(OrdinalContext)
  return C.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {previewURL, previewHeight, previewWidth} = message
    const {fileURL, downloadPath, transferState, videoDuration} = message
    const {height, width} = Constants.clampImageSize(previewWidth, previewHeight, maxWidth, maxHeight)
    return {downloadPath, height, previewURL, transferState, url: fileURL, videoDuration, width}
  }, C.shallowEqual)
}
