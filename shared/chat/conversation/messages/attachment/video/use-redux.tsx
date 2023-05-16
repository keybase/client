import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import {missingMessage, maxHeight} from '../shared'
import shallowEqual from 'shallowequal'
import {useSizing} from '../../../use-sizing'

export const useRedux = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)

  const rdata = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {previewURL, previewHeight, previewWidth} = message
    const {fileURL, downloadPath, transferState, videoDuration} = message
    return {
      downloadPath,
      previewHeight,
      previewURL,
      previewWidth,
      transferState,
      url: fileURL,
      videoDuration,
    }
  }, shallowEqual)

  const {width, height, onLayout} = useSizing('chatVideo', rdata.previewWidth, rdata.previewHeight, maxHeight)
  return {...rdata, height, onLayout, width}
}
