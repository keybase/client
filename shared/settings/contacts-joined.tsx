import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as React from 'react'
import UnconnectedFollowButton from '@/profile/user/actions/follow-button'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import {useTrackerState} from '@/stores/tracker2'
import {useFollowerState} from '@/stores/followers'

const renderItem = (_: number, item: T.RPCGen.ProcessedContact) => <Item item={item} />

type FollowProps = {
  username: string
  small?: boolean
}
const getFollowWaitingKey = (username: string) => `settings:followButton:${username}`

// used by people/follow-notification
export const FollowButton = (props: FollowProps) => {
  const {username} = props
  const userDetails = useTrackerState(s => s.getDetails(username))
  const followThem = useFollowerState(s => s.following.has(username))
  const followsYou = useFollowerState(s => s.followers.has(username))
  const {guiID} = userDetails

  const showUser = useTrackerState(s => s.dispatch.showUser)
  const changeFollow = useTrackerState(s => s.dispatch.changeFollow)

  React.useEffect(() => {
    if (!guiID) {
      showUser(username, false, true)
    }
  }, [username, guiID, showUser])

  const onFollow = React.useCallback(() => changeFollow(guiID, true), [changeFollow, guiID])
  const onUnfollow = React.useCallback(() => changeFollow(guiID, false), [changeFollow, guiID])

  const waitingKey = React.useMemo(() => [getFollowWaitingKey(username), C.waitingKeyTrackerProfileLoad], [username])

  return (
    <UnconnectedFollowButton
      disabled={userDetails.username !== username}
      following={followThem}
      followsYou={followsYou}
      waitingKey={waitingKey}
      small={props.small}
      onFollow={onFollow}
      onUnfollow={onUnfollow}
    />
  )
}

const Item = ({item}: {item: T.RPCGen.ProcessedContact}) => {
  const username = item.username
  const label = item.contactName || item.component.phoneNumber || item.component.email || ''

  const followThem = useFollowerState(s => s.following.has(username))
  if (followThem) {
    return null
  }
  return (
    <Kb.Box2 direction="horizontal" key={username} fullWidth={true}>
      <Kb.Box style={styles.avatar}>
        <Kb.Avatar username={username} size={48} />
      </Kb.Box>
      <Kb.Box2 direction="vertical" style={styles.rightBox}>
        <Kb.ConnectedUsernames colorFollowing={true} type="BodyBold" usernames={username} />
        <Kb.Text type="BodySmall">{label}</Kb.Text>
        <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} style={styles.buttons}>
          <FollowButton username={username} small={true} />
          <Kb.WaveButton username={username} small={true} />
        </Kb.Box2>
        <Kb.Divider style={styles.divider} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const ContactsJoinedModal = () => {
  const people = useSettingsContactsState(s => s.alreadyOnKeybase)
  const nav = useSafeNavigation()
  const onClose = () => nav.safeNavigateUp()
  return (
    <Kb.Modal
      header={{
        hideBorder: true,
        leftButton: (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            Done
          </Kb.Text>
        ),
      }}
    >
      <Kb.Text type="Body" style={styles.woot} center={true}>
        Woot! Some of your contacts are already on Keybase.
      </Kb.Text>
      <Kb.List items={people} renderItem={renderItem} indexAsKey={true} />
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      avatar: {
        marginLeft: Kb.Styles.globalMargins.tiny,
        marginRight: Kb.Styles.globalMargins.small,
      },
      buttons: {
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginTop: Kb.Styles.globalMargins.xtiny,
      },
      divider: {
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      rightBox: {flexGrow: 1},
      woot: {
        marginBottom: Kb.Styles.globalMargins.small,
        marginLeft: Kb.Styles.globalMargins.medium,
        marginRight: Kb.Styles.globalMargins.medium,
        marginTop: Kb.Styles.globalMargins.small,
      },
    }) as const
)

export default ContactsJoinedModal
