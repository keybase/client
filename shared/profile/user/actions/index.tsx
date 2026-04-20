import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import FollowButton from './follow-button'
import ChatButton from '@/chat/chat-button'
import * as FS from '@/stores/fs'
import {useCurrentUserState} from '@/stores/current-user'
import {useFeaturedBot} from '@/util/featured-bots'

type OwnProps = {
  blocked: boolean
  followThem: boolean
  followsYou: boolean
  guiID: string
  hidFromFollowers: boolean
  onReload: () => void
  state: T.Tracker.DetailsState
  username: string
}

const Container = (ownProps: OwnProps) => {
  const {blocked, followThem, followsYou, guiID, hidFromFollowers, onReload, state, username} = ownProps
  const isBot = !!useFeaturedBot(username)
  const _you = useCurrentUserState(s => s.username)

  const navigateAppend = C.Router2.navigateAppend
  const _onAddToTeam = (username: string) => navigateAppend({name: 'profileAddToTeam', params: {username}})
  const _onBrowsePublicFolder = (username: string) =>
    FS.navToPath(T.FS.stringToPath(`/keybase/public/${username}`))
  const _onEditProfile = () => navigateAppend({name: 'profileEdit', params: {}})

  const followUser = C.useRPC(T.RPCGen.identify3Identify3FollowUserRpcPromise)
  const _onFollow = (follow: boolean) => {
    followUser([{follow, guiID}, C.waitingKeyTracker], onReload, () => {})
  }
  const _onInstallBot = (username: string) => {
    navigateAppend({name: 'chatInstallBotPick', params: {botUsername: username}})
  }
  const _onManageBlocking = (username: string) =>
    navigateAppend({name: 'chatBlockingModal', params: {username}})
  const _onOpenPrivateFolder = (myUsername: string, theirUsername: string) =>
    FS.navToPath(T.FS.stringToPath(`/keybase/private/${theirUsername},${myUsername}`))
  const onAccept = () => _onFollow(true)
  const onAddToTeam = () => _onAddToTeam(username)
  const onBrowsePublicFolder = () => _onBrowsePublicFolder(username)
  const onEditProfile = _you === username ? _onEditProfile : undefined
  const onFollow = () => _onFollow(true)
  const onInstallBot = () => _onInstallBot(username)
  const onManageBlocking = () => _onManageBlocking(username)
  const onOpenPrivateFolder = () => _onOpenPrivateFolder(_you, username)
  const onUnfollow = () => _onFollow(false)

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
  const makePopup = (p: Kb.Popup2Parms) => {
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
  }
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
