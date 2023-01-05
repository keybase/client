import * as Container from '../../../../util/container'
import * as React from 'react'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type AttachmentMessageType from './container'

const WrapperAttachment = React.memo(function WrapperAttachment(p: Props) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {ordinal} = p
  const common = useCommon(ordinal)
  const {showCenteredHighlight, toggleShowingPopup} = common

  const AttachmentMessage = require('./container').default as typeof AttachmentMessageType

  // TODO not message
  const message = Container.useSelector(state => {
    const message = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    return message
  })

  if (message?.type !== 'attachment') return null

  return (
    <WrapperMessage {...p} {...common}>
      <AttachmentMessage
        key="attachment"
        message={message}
        isHighlighted={showCenteredHighlight}
        toggleMessageMenu={toggleShowingPopup}
      />
    </WrapperMessage>
  )
})

export default WrapperAttachment
