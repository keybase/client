import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import SystemMessageTimestamp from '../system-message-timestamp'

type YouAddedProps = {
  author: string
  channelname: string
  otherUsers: Array<string>
  timestamp: number
}

const YouAdded = (props: YouAddedProps) => (
  <UserNotice username={props.author} bgColor={Styles.globalColors.blueLighter2}>
    <SystemMessageTimestamp timestamp={props.timestamp} />
    <Kb.Text center={true} type="BodySmallSemibold">
      <Kb.ConnectedUsernames
        inline={true}
        type="BodySmallSemibold"
        onUsernameClicked="profile"
        colorFollowing={true}
        underline={true}
        usernames={[props.author]}
      />{' '}
      added you
      {!!props.otherUsers.length && [
        props.otherUsers.length === 1 ? ' and ' : ', ',
        ...getAddedUsernames(props.otherUsers),
      ]}
      {!props.otherUsers.length && ' '}
      to #{props.channelname}.
    </Kb.Text>
  </UserNotice>
)

const maxUsernamesToShow = 3
const getAddedUsernames = (usernames: Array<string>) => {
  const diff = Math.max(0, usernames.length - maxUsernamesToShow)
  const othersStr = diff ? `and ${diff} other${diff > 1 ? 's' : ''} ` : ''
  const users = usernames.slice(0, maxUsernamesToShow)
  return users.reduce<Array<React.ReactNode>>((res, username, idx) => {
    if (idx === users.length - 1 && users.length > 1 && !othersStr) {
      // last user and no others
      res.push('and ')
    }
    res.push(
      <Kb.ConnectedUsernames
        inline={true}
        type="BodySmallSemibold"
        onUsernameClicked="profile"
        colorFollowing={true}
        underline={true}
        usernames={[username]}
        key={username}
      />,
      idx < users.length - (othersStr ? 1 : 2) ? ', ' : ' '
    )
    if (idx === users.length - 1 && othersStr) {
      res.push(othersStr)
    }
    return res
  }, [])
}

type OthersAddedProps = {
  author: string
  channelname: string
  added: Array<string>
  timestamp: number
}

const OthersAdded = (props: OthersAddedProps) => (
  <Kb.Text type="BodySmall" style={styles.text}>
    added {getAddedUsernames(props.added)}to #{props.channelname}.
  </Kb.Text>
)

const styles = Styles.styleSheetCreate({
  text: {flexGrow: 1},
})

export {OthersAdded, YouAdded}
