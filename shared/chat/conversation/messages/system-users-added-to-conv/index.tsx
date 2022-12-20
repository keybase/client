import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'

type YouAddedProps = {
  author: string
  channelname: string
  otherUsers: Array<string>
  timestamp: number
}

const YouAdded = (props: YouAddedProps) => (
  <UserNotice>
    <Kb.Text type="BodySmall">
      added you
      {!!props.otherUsers.length && [
        props.otherUsers.length === 1 ? ' and ' : ', ',
        ...getAddedUsernames(props.otherUsers),
      ]}{' '}
      to #{props.channelname}.
    </Kb.Text>
  </UserNotice>
)

const maxUsernamesToShow = 3
const getAddedUsernames = (usernames: Array<string>) => {
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

type OthersAddedProps = {
  author: string
  channelname: string
  added: Array<string>
  timestamp: number
}

const OthersAdded = (props: OthersAddedProps) => (
  <UserNotice>
    <Kb.Text type="BodySmall" style={styles.text}>
      added {getAddedUsernames(props.added)} to #{props.channelname}.
    </Kb.Text>
  </UserNotice>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      text: {flexGrow: 1},
    } as const)
)

export {OthersAdded, YouAdded, getAddedUsernames}
