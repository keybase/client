import * as React from 'react'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as Styles from '../../../../../styles'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import {missingMessage} from '../shared'
import shallowEqual from 'shallowequal'

const maxWidth = Styles.isMobile ? Math.min(320, Styles.dimensionWidth - 68) : 320

export const useRedux = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  return Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {previewURL, previewHeight, previewWidth, fileURL} = message
    const {height, width} = Constants.clampImageSize(previewWidth, previewHeight, maxWidth)
    return {height, previewURL, url: fileURL, width}
  }, shallowEqual)
}
