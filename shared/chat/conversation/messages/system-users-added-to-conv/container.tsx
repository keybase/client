import * as C from '../../../../constants'
import * as React from 'react'
import type * as Types from '../../../../constants/types/chat2'
import {YouAdded, OthersAdded} from '.'

type OwnProps = {message: Types.MessageSystemUsersAddedToConversation}

const UsersAddedToConversationContainer = React.memo(function UsersAddedToConversationContainer(p: OwnProps) {
  const {message} = p
  const {usernames, author, timestamp} = message
  const channelname = C.useChatContext(s => s.meta.channelname)
  const you = C.useCurrentUserState(s => s.username)

  const props = {
    author,
    channelname,
    timestamp,
  }
  let otherUsers: Array<string> | undefined
  if (usernames.includes(you)) {
    otherUsers = usernames.slice()
    otherUsers.splice(
      otherUsers.findIndex(u => u === you),
      1
    )
  }
  return otherUsers ? (
    <YouAdded {...props} otherUsers={otherUsers} />
  ) : (
    <OthersAdded {...props} added={usernames} />
  )
})
export default UsersAddedToConversationContainer
