import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import {YouAdded, OthersAdded} from '.'

type OwnProps = {
  message: Types.MessageSystemUsersAddedToConversation
}

type SwitcherProps = {
  added: Array<string>
  author: string
  channelname: string
  timestamp: number
  you: string
}

const UsersAddedToConversation = (props: SwitcherProps) => {
  const common = {
    author: props.author,
    channelname: props.channelname,
    timestamp: props.timestamp,
  }
  let otherUsers
  if (props.added.includes(props.you)) {
    otherUsers = props.added.slice()
    otherUsers.splice(
      otherUsers.findIndex(u => u === props.you),
      1
    )
  }
  return otherUsers ? (
    <YouAdded {...common} otherUsers={otherUsers} />
  ) : (
    <OthersAdded {...common} added={props.added} />
  )
}

export default Container.namedConnect(
  (state, {message}: OwnProps) => ({
    channelname: Constants.getMeta(state, message.conversationIDKey).channelname,
    you: state.config.username,
  }),
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    added: ownProps.message.usernames,
    author: ownProps.message.author,
    channelname: stateProps.channelname,
    timestamp: ownProps.message.timestamp,
    you: stateProps.you,
  }),
  'ConnectedUsersAddedToConversation'
)(UsersAddedToConversation)
