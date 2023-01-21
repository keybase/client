import * as React from 'react'
import * as Styles from '../../../../../styles'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
// import type {Props} from './imageimpl'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'

const missingMessage = Constants.makeMessageAttachment()

const Image2Impl = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const data = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {previewHeight, previewURL, previewWidth} = message
    // const editInfo = Constants.getEditInfo(state, conversationIDKey)
    // const {decoratedText, downloadPath, fileName, fileURL, inlineVideoPlayable} = message
    // const {isCollapsed, previewHeight, previewURL, previewWidth} = message
    // const {title, transferErrMsg, transferProgress, transferState, videoDuration} = message

    // const downloadError = !!transferErrMsg
    return {previewHeight, previewURL, previewWidth}
  })

  const {previewHeight, previewURL, previewWidth} = data

  const {height, width} = Constants.clampImageSize(previewWidth, previewHeight, Math.min(320, 320))

  const style = Styles.collapseStyles([
    styles.image,
    {
      backgroundColor: undefined,
      height,
      width,
    },
  ])

  // onLoad = {onLoad}
  return (
    <img
      draggable={false}
      src={previewURL}
      style={style}
      // Styles.collapseStyles([style, !loaded && {opacity: 0}])}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  image: {
    ...Styles.globalStyles.rounded,
    backgroundColor: Styles.globalColors.fastBlank,
    marginBottom: 3,
    marginLeft: 3,
    marginRight: 3,
    marginTop: 0,
    maxWidth: 320,
    position: 'relative',
  },
}))

export default Image2Impl
