import * as React from 'react'
import * as Styles from '../../../../../styles'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'

const missingMessage = Constants.makeMessageAttachment()

const Image2Impl = () => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const {previewURL} = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const {previewURL} = message
    return {previewURL}
  })
  return <img draggable={false} src={previewURL} style={styles.image} />
}

const styles = Styles.styleSheetCreate(() => ({
  image: {
    ...Styles.globalStyles.rounded,
    maxHeight: 320,
    maxWidth: 320,
  },
}))

export default Image2Impl
