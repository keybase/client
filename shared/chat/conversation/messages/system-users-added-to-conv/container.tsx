import * as Chat from '@/stores/chat2'
import * as React from 'react'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {message: T.Chat.MessageSystemUsersAddedToConversation}

const UsersAddedToConversationContainer = React.memo(function UsersAddedToConversationContainer(p: OwnProps) {
  const {usernames} = p.message
  const channelname = Chat.useChatContext(s => s.meta.channelname)
  const you = useCurrentUserState(s => s.username)
  let otherUsers: Array<string> | undefined
  if (usernames.includes(you)) {
    otherUsers = usernames.slice()
    otherUsers.splice(
      otherUsers.findIndex(u => u === you),
      1
    )
  }
  return otherUsers ? (
    <UserNotice>
      <Kb.Text type="BodySmall">
        added you
        {!!otherUsers.length && [
          otherUsers.length === 1 ? ' and ' : ', ',
          ...getAddedUsernames(otherUsers),
        ]}{' '}
        to #{channelname}.
      </Kb.Text>
    </UserNotice>
  ) : (
    <UserNotice>
      <Kb.Text type="BodySmall" style={styles.text}>
        added {getAddedUsernames(usernames)} to #{channelname}.
      </Kb.Text>
    </UserNotice>
  )
})

const maxUsernamesToShow = 1
export const getAddedUsernames = (usernames?: ReadonlyArray<string>) => {
  if (!usernames) return []
  const diff = Math.max(0, usernames.length - maxUsernamesToShow)
  const othersStr = diff ? ` and ${diff} other${diff > 1 ? 's' : ''}` : ''
  const users = usernames.slice(0, maxUsernamesToShow)
  return users.reduce<Array<React.ReactNode>>((res, username, idx) => {
    if (idx === users.length - 1 && users.length > 1 && !othersStr) {
      // last user and no others
      res.push(' and ')
    }
    res.push(
      <Kb.ConnectedUsernames
        inline={true}
        type="BodySmallBold"
        onUsernameClicked="profile"
        colorFollowing={true}
        underline={true}
        usernames={username}
        key={username}
      />,
      idx < users.length - (othersStr ? 1 : 2) ? ', ' : ''
    )
    if (idx === users.length - 1 && othersStr) {
      res.push(othersStr)
    }
    return res
  }, [])
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      text: {flexGrow: 1},
    }) as const
)

export default UsersAddedToConversationContainer
