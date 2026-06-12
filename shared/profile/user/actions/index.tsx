import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import FollowButton from './follow-button'
import ChatButton from '@/chat/chat-button'
import * as FS from '@/constants/fs'
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

const ActionsContainer = ({children}: {children: React.ReactNode}) => (
  <Kb.Box2 gap="tiny" centerChildren={true} direction="horizontal" fullWidth={true}>
    {children}
  </Kb.Box2>
)

const Actions = (ownProps: OwnProps) => {
  const {blocked, followThem, followsYou, guiID, hidFromFollowers, onReload, state, username} = ownProps
  const isBot = !!useFeaturedBot(username)
  const you = useCurrentUserState(s => s.username)

  const navigateAppend = C.Router2.navigateAppend
  const followUser = C.useRPC(T.RPCGen.identify3Identify3FollowUserRpcPromise)
  const follow = (f: boolean) => followUser([{follow: f, guiID}, C.waitingKeyTracker], onReload, () => {})

  const onAccept = () => follow(true)
  const onAddToTeam = () => navigateAppend({name: 'profileAddToTeam', params: {username}})
  const onBrowsePublicFolder = () => FS.navToPath(T.FS.stringToPath(`/keybase/public/${username}`))
  const onEditProfile = you === username ? () => navigateAppend({name: 'profileEdit', params: {}}) : undefined
  const onFollow = () => follow(true)
  const onInstallBot = () => navigateAppend({name: 'chatInstallBotPick', params: {botUsername: username}})
  const onManageBlocking = () => navigateAppend({name: 'chatBlockingModal', params: {username}})
  const onOpenPrivateFolder = () => FS.navToPath(T.FS.stringToPath(`/keybase/private/${username},${you}`))
  const onUnfollow = () => follow(false)

  if (blocked) {
    return (
      <ActionsContainer>
        <Kb.Button
          key="Manage blocking"
          mode="Secondary"
          type="Danger"
          label="Manage blocking"
          onClick={onManageBlocking}
        />
      </ActionsContainer>
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
    <ActionsContainer>{state === 'checking' ? <Kb.ProgressIndicator type="Small" /> : buttons}</ActionsContainer>
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
      if (i) {
        arr.push(i as Kb.MenuItem)
      }
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
    <Kb.ClickableBox direction="horizontal" gap="xsmall" onClick={showPopup} ref={popupAnchor}>
      <Kb.Button onClick={undefined} mode="Secondary" style={styles.dropdownButton}>
        <Kb.Icon color={Kb.Styles.globalColors.blue} type="iconfont-ellipsis" />
      </Kb.Button>
      {popup}
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  dropdownButton: {minWidth: undefined},
}))

export default Actions
