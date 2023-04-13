import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import {missingMessage, maxWidth, maxHeight} from '../shared'
import shallowEqual from 'shallowequal'

export const useRedux = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  return Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {previewURL, previewHeight, previewWidth} = message
    const {fileURL, downloadPath, transferState, videoDuration} = message
    const {height, width} = Constants.clampImageSize(previewWidth, previewHeight, maxWidth, maxHeight)
    return {downloadPath, height, previewURL, transferState, url: fileURL, videoDuration, width}
  }, shallowEqual)
}
