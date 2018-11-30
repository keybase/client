// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import TextMessage from '.'

type Props = {|
  isEditing: boolean,
  message: Types.MessageText,
|}

const Wrapper = (props: Props) => (
  <TextMessage
    isEditing={props.isEditing}
    mentionsAt={props.message.mentionsAt}
    mentionsChannel={props.message.mentionsChannel}
    mentionsChannelName={props.message.mentionsChannelName}
    text={props.message.text.stringValue()}
    type={props.message.errorReason ? 'error' : props.message.submitState === null ? 'sent' : 'pending'}
  />
)
export default Wrapper
