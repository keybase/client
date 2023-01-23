import * as React from 'react'
import * as Styles from '../../../../../styles'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import shallowEqual from 'shallowequal'

const missingMessage = Constants.makeMessageAttachment()

const Image2Impl = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const {previewURL, height, width} = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {previewURL, previewHeight, previewWidth} = message
    return {height: previewHeight, previewURL, width: previewWidth}
  }, shallowEqual)

  const fiSrc = React.useMemo(() => ({uri: previewURL}), [previewURL])
  return (
    <Kb.NativeFastImage
      source={fiSrc}
      style={Styles.collapseStyles([styles.image, {height, width}])}
      resizeMode="cover"
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  image: {
    ...Styles.globalStyles.rounded,
    maxHeight: 320,
    maxWidth: '100%',
  },
}))

export default Image2Impl
