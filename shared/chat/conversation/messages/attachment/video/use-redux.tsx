import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import {OrdinalContext} from '../../ids-context'
import {missingMessage, maxWidth, maxHeight} from '../shared'
import shallowEqual from 'shallowequal'

export const useRedux = () => {
  const ordinal = React.useContext(OrdinalContext)
  return Constants.useContext(s => {
    const m = s.messageMap.get(ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {previewURL, previewHeight, previewWidth} = message
    const {fileURL, downloadPath, transferState, videoDuration} = message
    const {height, width} = Constants.clampImageSize(previewWidth, previewHeight, maxWidth, maxHeight)
    return {downloadPath, height, previewURL, transferState, url: fileURL, videoDuration, width}
  }, shallowEqual)
}
