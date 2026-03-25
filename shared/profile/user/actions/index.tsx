import * as C from '@/constants'
import * as FS from '@/stores/fs'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import ChatButton from '@/chat/chat-button'
import FollowButton from './follow-button'
import {useBotsState} from '@/stores/bots'
import {useCurrentUserState} from '@/stores/current-user'
import {useFollowerState} from '@/stores/followers'
import {useTrackerState} from '@/stores/tracker'

type OwnProps = {username: string}

type ActionState = {
  chatButton: React.ReactNode
  dropdown: React.ReactNode
  followThem: boolean
  followsYou: boolean
  onAccept: () => void
  onEditProfile?: () => void
  onFollow: () => void
  onOpenFolder: () => void
  onReload: () => void
  onUnfollow: () => void
  state: T.Tracker.DetailsState
}

const ActionRow = ({children}: {children: React.ReactNode}) => (
  <Kb.Box2 gap="tiny" centerChildren={true} direction="horizontal" fullWidth={true}>
    {children}
  </Kb.Box2>
)

const getButtons = ({
  chatButton,
  dropdown,
  followThem,
  followsYou,
  onAccept,
  onEditProfile,
  onFollow,
  onOpenFolder,
  onReload,
  onUnfollow,
  state,
}: ActionState): Array<React.ReactNode> => {
  if (state === 'notAUserYet') {
    return [
      chatButton,
      <Kb.Button key="Open folder" mode="Secondary" label="Open folder" onClick={onOpenFolder} />,
    ]
  }

  if (onEditProfile) {
    return [
      <Kb.Button key="Edit profile" mode="Secondary" label="Edit profile" onClick={onEditProfile} />,
      chatButton,
    ]
  }

  if (followThem) {
    switch (state) {
      case 'valid':
        return [
          <FollowButton
            key="Unfollow"
            following={true}
            onUnfollow={onUnfollow}
            waitingKey={C.waitingKeyTracker}
          />,
          chatButton,
          dropdown,
        ]
      case 'needsUpgrade':
        return [
          chatButton,
          <Kb.WaitingButton
            key="Accept"
            type="Success"
            label="Accept"
            waitingKey={C.waitingKeyTracker}
            onClick={onAccept}
          />,
          dropdown,
        ]
      default:
        return [
          <Kb.WaitingButton key="Reload" label="Reload" waitingKey={C.waitingKeyTracker} onClick={onReload} />,
          <Kb.WaitingButton
            key="Accept"
            type="Success"
            label="Accept"
            waitingKey={C.waitingKeyTracker}
            onClick={onAccept}
          />,
          dropdown,
        ]
    }
  }

  if (state === 'error') {
    return [
      <Kb.WaitingButton key="Reload" label="Reload" waitingKey={C.waitingKeyTracker} onClick={onReload} />,
      chatButton,
      dropdown,
    ]
  }

  return [
    <FollowButton
      key="Follow"
      following={false}
      followsYou={followsYou}
      onFollow={onFollow}
      waitingKey={C.waitingKeyTracker}
    />,
    chatButton,
    dropdown,
  ]
}

const Container = ({username}: OwnProps) => {
  const {blocked, guiID, hidFromFollowers, state} = useTrackerState(s => s.getDetails(username))
  const followThem = useFollowerState(s => s.following.has(username))
  const followsYou = useFollowerState(s => s.followers.has(username))
  const isBot = useBotsState(s => s.featuredBotsMap.has(username))
  const currentUsername = useCurrentUserState(s => s.username)
  const {changeFollow, showUser} = useTrackerState(
    C.useShallow(s => ({
      changeFollow: s.dispatch.changeFollow,
      showUser: s.dispatch.showUser,
    }))
  )
  const {navigateAppend} = C.useRouterState(
    C.useShallow(s => ({
      navigateAppend: s.dispatch.navigateAppend,
    }))
  )

  const onAddToTeam = () => navigateAppend({name: 'profileAddToTeam', params: {username}})
  const onBrowsePublicFolder = () => FS.navToPath(T.FS.stringToPath(`/keybase/public/${username}`))
  const onEditProfile = currentUsername === username ? () => navigateAppend('profileEdit') : undefined
  const onFollow = () => changeFollow(guiID, true)
  const onInstallBot = () => navigateAppend({name: 'chatInstallBotPick', params: {botUsername: username}})
  const onManageBlocking = () => navigateAppend({name: 'chatBlockingModal', params: {username}})
  const onOpenPrivateFolder = () =>
    FS.navToPath(T.FS.stringToPath(`/keybase/private/${username},${currentUsername}`))
  const onReload = () => showUser(username, false)
  const onUnfollow = () => changeFollow(guiID, false)
  const onAccept = onFollow

  const getFeaturedBots = useBotsState(s => s.dispatch.getFeaturedBots)
  React.useEffect(() => {
    getFeaturedBots()
  }, [getFeaturedBots])

  if (blocked) {
    return (
      <ActionRow>
        <Kb.Button
          key="Manage blocking"
          mode="Secondary"
          type="Danger"
          label="Manage blocking"
          onClick={onManageBlocking}
        />
      </ActionRow>
    )
  }

  const dropdown = (
    <DropdownButton
      blockedOrHidFromFollowers={hidFromFollowers}
      key="dropdown"
      isBot={isBot}
      onAddToTeam={onAddToTeam}
      onBrowsePublicFolder={onBrowsePublicFolder}
      onInstallBot={onInstallBot}
      onManageBlocking={onManageBlocking}
      onOpenPrivateFolder={onOpenPrivateFolder}
      onUnfollow={followThem && state !== 'valid' ? onUnfollow : undefined}
    />
  )

  const buttons = getButtons({
    chatButton: <ChatButton key="Chat" username={username} />,
    dropdown,
    followThem,
    followsYou,
    onAccept,
    onEditProfile,
    onFollow,
    onOpenFolder: onOpenPrivateFolder,
    onReload,
    onUnfollow,
    state,
  })

  return (
    <ActionRow>{state === 'checking' ? <Kb.ProgressIndicator type="Small" /> : buttons}</ActionRow>
  )
}

type DropdownProps = {
  blockedOrHidFromFollowers: boolean
  isBot: boolean
  onAddToTeam: () => void
  onBrowsePublicFolder: () => void
  onInstallBot: () => void
  onManageBlocking: () => void
  onOpenPrivateFolder: () => void
  onUnfollow?: () => void
}

const makeMenuItems = ({
  blockedOrHidFromFollowers,
  isBot,
  onAddToTeam,
  onBrowsePublicFolder,
  onInstallBot,
  onManageBlocking,
  onOpenPrivateFolder,
  onUnfollow,
}: DropdownProps): Kb.MenuItems =>
  [
    isBot
      ? {icon: 'iconfont-nav-2-robot', onClick: onInstallBot, title: 'Install bot in team or chat'}
      : {icon: 'iconfont-people', onClick: onAddToTeam, title: 'Add to team...'},
    {icon: 'iconfont-folder-open', onClick: onOpenPrivateFolder, title: 'Open private folder'},
    {icon: 'iconfont-folder-public', onClick: onBrowsePublicFolder, title: 'Browse public folder'},
    onUnfollow && {icon: 'iconfont-wave', onClick: onUnfollow, title: 'Unfollow'},
    {
      danger: true,
      icon: 'iconfont-remove',
      onClick: onManageBlocking,
      title: blockedOrHidFromFollowers ? 'Manage blocking' : 'Block',
    },
  ].reduce<Kb.MenuItems>((items, item) => {
    if (item) {
      items.push(item as Kb.MenuItem)
    }
    return items
  }, [])

const DropdownButton = (props: DropdownProps) => {
  const makePopup = ({attachTo, hidePopup}: Kb.Popup2Parms) => (
    <Kb.FloatingMenu
      closeOnSelect={true}
      attachTo={attachTo}
      items={makeMenuItems(props)}
      onHidden={hidePopup}
      position="bottom right"
      visible={true}
    />
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.ClickableBox onClick={showPopup} ref={popupAnchor}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
        <Kb.Button onClick={undefined} mode="Secondary" style={styles.dropdownButton}>
          <Kb.Icon color={Kb.Styles.globalColors.blue} type="iconfont-ellipsis" />
        </Kb.Button>
      </Kb.Box2>
      {popup}
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  dropdownButton: {minWidth: undefined},
}))

export default Container
