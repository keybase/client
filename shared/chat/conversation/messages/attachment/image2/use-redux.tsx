import shallowEqual from 'shallowequal'
import * as Constants from '../../../../../constants/chat2'
import * as React from 'react'
import {OrdinalContext} from '../../ids-context'
import {maxWidth, maxHeight} from '../shared'

const missingMessage = Constants.makeMessageAttachment()

export const useRedux = () => {
  const ordinal = React.useContext(OrdinalContext)
  return Constants.useContext(s => {
    const m = s.messageMap.get(ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {previewURL, previewHeight, previewWidth} = message
    const {height, width} = Constants.clampImageSize(previewWidth, previewHeight, maxWidth, maxHeight)
    return {height, previewURL, width}
  }, shallowEqual)
}
