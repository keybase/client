import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as ConfigConstants from '../../../../constants/config'
import type * as Types from '../../../../constants/types/chat2'
import {YouAdded, OthersAdded} from '.'

type OwnProps = {message: Types.MessageSystemUsersAddedToConversation}

const UsersAddedToConversationContainer = React.memo(function UsersAddedToConversationContainer(p: OwnProps) {
  const {message} = p
  const {usernames, author, timestamp} = message
  const channelname = Constants.useContext(s => s.meta.channelname)
  const you = ConfigConstants.useCurrentUserState(s => s.username)

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
