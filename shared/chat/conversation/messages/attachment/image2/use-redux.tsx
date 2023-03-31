import shallowEqual from 'shallowequal'
import * as Constants from '../../../../../constants/chat2'
import * as React from 'react'
import * as Container from '../../../../../util/container'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import {maxWidth} from '../shared'

const missingMessage = Constants.makeMessageAttachment()

export const useRedux = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  return Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {previewURL, previewHeight, previewWidth} = message
    const {height, width} = Constants.clampImageSize(previewWidth, previewHeight, maxWidth)
    return {height, previewURL, width}
  }, shallowEqual)
}
