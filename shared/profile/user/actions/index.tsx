import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import FollowButton from './follow-button'
import ChatButton from '@/chat/chat-button'
import {useBotsState} from '@/stores/bots'
import {useTrackerState} from '@/stores/tracker2'
import * as FS from '@/stores/fs'
import {useFollowerState} from '@/stores/followers'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {username: string}

const Container = (ownProps: OwnProps) => {
  const username = ownProps.username
  const d = useTrackerState(s => s.getDetails(username))
  const followThem = useFollowerState(s => s.following.has(username))
  const followsYou = useFollowerState(s => s.followers.has(username))
  const isBot = useBotsState(s => s.featuredBotsMap.has(username))

  const _guiID = d.guiID
  const _you = useCurrentUserState(s => s.username)
  const blocked = d.blocked
  const hidFromFollowers = d.hidFromFollowers
  const state = d.state

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _onAddToTeam = (username: string) => navigateAppend({props: {username}, selected: 'profileAddToTeam'})
  const _onBrowsePublicFolder = (username: string) =>
    FS.navToPath(T.FS.stringToPath(`/keybase/public/${username}`))
  const _onEditProfile = () => navigateAppend('profileEdit')

  const changeFollow = useTrackerState(s => s.dispatch.changeFollow)
  const _onFollow = changeFollow
  const _onInstallBot = (username: string) => {
    navigateAppend({props: {botUsername: username}, selected: 'chatInstallBotPick'})
  }
  const _onManageBlocking = (username: string) =>
    navigateAppend({props: {username}, selected: 'chatBlockingModal'})
  const _onOpenPrivateFolder = (myUsername: string, theirUsername: string) =>
    FS.navToPath(T.FS.stringToPath(`/keybase/private/${theirUsername},${myUsername}`))
  const showUser = useTrackerState(s => s.dispatch.showUser)
  const _onReload = (username: string) => {
    showUser(username, false)
  }
  const onAccept = () => _onFollow(_guiID, true)
  const onAddToTeam = () => _onAddToTeam(username)
  const onBrowsePublicFolder = () => _onBrowsePublicFolder(username)
  const onEditProfile = _you === username ? _onEditProfile : undefined
  const onFollow = () => _onFollow(_guiID, true)
  const onInstallBot = () => _onInstallBot(username)
  const onManageBlocking = () => _onManageBlocking(username)
  const onOpenPrivateFolder = () => _onOpenPrivateFolder(_you, username)
  const onReload = () => _onReload(username)
  const onUnfollow = () => _onFollow(_guiID, false)

  const getFeaturedBots = useBotsState(s => s.dispatch.getFeaturedBots)
  // load featured bots on first render
  React.useEffect(() => {
    // TODO likely don't do this all the time, just once
    getFeaturedBots()
  }, [getFeaturedBots])
  if (blocked) {
    return (
      <Kb.Box2 gap="tiny" centerChildren={true} direction="horizontal" fullWidth={true}>
        <Kb.Button
          key="Manage blocking"
          mode="Secondary"
          type="Danger"
          label="Manage blocking"
          onClick={onManageBlocking}
        />
      </Kb.Box2>
    )
  }

  let buttons: Array<React.ReactNode>

  const dropdown = (
    <DropdownButton
      blockedOrHidFromFollowers={hidFromFollowers}
      key="dropdown"
      isBot={isBot}
      onAddToTeam={onAddToTeam}
      onOpenPrivateFolder={onOpenPrivateFolder}
      onBrowsePublicFolder={onBrowsePublicFolder}
      onInstallBot={onInstallBot}
      onUnfollow={followThem && state !== 'valid' ? onUnfollow : undefined}
      onManageBlocking={onManageBlocking}
    />
  )

  const chatButton = <ChatButton key="Chat" username={username} />

  if (state === 'notAUserYet') {
    buttons = [
      chatButton,
      <Kb.Button key="Open folder" mode="Secondary" label="Open folder" onClick={onOpenPrivateFolder} />,
    ]
  } else if (onEditProfile) {
    buttons = [
      <Kb.Button key="Edit profile" mode="Secondary" label="Edit profile" onClick={onEditProfile} />,
      chatButton,
    ]
  } else if (followThem) {
    if (state === 'valid') {
      buttons = [
        <FollowButton
          key="Unfollow"
          following={true}
          onUnfollow={onUnfollow}
          waitingKey={C.waitingKeyTracker}
        />,
        chatButton,
        dropdown,
      ]
    } else if (state === 'needsUpgrade') {
      buttons = [
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
    } else {
      buttons = [
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
  } else {
    if (state === 'error') {
      buttons = [
        <Kb.WaitingButton key="Reload" label="Reload" waitingKey={C.waitingKeyTracker} onClick={onReload} />,
        chatButton,
        dropdown,
      ]
    } else {
      buttons = [
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
  }

  return (
    <Kb.Box2 gap="tiny" centerChildren={true} direction="horizontal" fullWidth={true}>
      {state === 'checking' ? <Kb.ProgressIndicator type="Small" /> : buttons}
    </Kb.Box2>
  )
}

type DropdownProps = {
  onManageBlocking: () => void
  onInstallBot: () => void
  onBrowsePublicFolder: () => void
  onOpenPrivateFolder: () => void
  onAddToTeam: () => void
  isBot: boolean
  blockedOrHidFromFollowers: boolean
  onUnfollow?: () => void
}

const DropdownButton = (p: DropdownProps) => {
  const {onInstallBot, onAddToTeam, onBrowsePublicFolder, onUnfollow} = p
  const {onManageBlocking, blockedOrHidFromFollowers, isBot, onOpenPrivateFolder} = p
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      const items: Kb.MenuItems = [
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
      ].reduce<Kb.MenuItems>((arr, i) => {
        i && arr.push(i as Kb.MenuItem)
        return arr
      }, [])
      return (
        <Kb.FloatingMenu
          closeOnSelect={true}
          attachTo={attachTo}
          items={items}
          onHidden={hidePopup}
          position="bottom right"
          visible={true}
        />
      )
    },
    [
      blockedOrHidFromFollowers,
      isBot,
      onAddToTeam,
      onBrowsePublicFolder,
      onInstallBot,
      onManageBlocking,
      onOpenPrivateFolder,
      onUnfollow,
    ]
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
  chatIcon: {marginRight: Kb.Styles.globalMargins.tiny},
  dropdownButton: {minWidth: undefined},
}))

export default Container
