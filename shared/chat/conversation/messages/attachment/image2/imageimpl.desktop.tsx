import * as React from 'react'
import * as Styles from '../../../../../styles'
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
  return <img draggable={false} src={previewURL} height={height} width={width} style={styles.image as any} />
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      image: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.rounded,
          maxHeight: 320,
          maxWidth: 320,
          objectFit: 'contain',
        },
      }),
    } as const)
)

export default Image2Impl
