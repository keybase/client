import * as Constants from '../../../constants/tracker2'
import * as BotsConstants from '../../../constants/bots'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../styles'
import type * as Types from '../../../constants/types/tracker2'
import FollowButton from './follow-button'
import ChatButton from '../../../chat/chat-button'

type Props = {
  followThem: boolean
  followsYou: boolean
  blocked: boolean
  hidFromFollowers: boolean
  isBot: boolean
  onAccept: () => void
  onAddToTeam: () => void
  onBrowsePublicFolder: () => void
  onEditProfile?: () => void
  onFollow: () => void
  onIgnoreFor24Hours: () => void
  onInstallBot: () => void
  onOpenPrivateFolder: () => void
  onReload: () => void
  onUnfollow: () => void
  onManageBlocking: () => void
  state: Types.DetailsState
  username: string
}

type DropdownProps = Pick<
  Props,
  | 'isBot'
  | 'onAddToTeam'
  | 'onOpenPrivateFolder'
  | 'onBrowsePublicFolder'
  | 'onInstallBot'
  | 'onManageBlocking'
> & {
  blockedOrHidFromFollowers: boolean
  onUnfollow?: () => void
}

const Actions = (p: Props) => {
  const getFeaturedBots = BotsConstants.useState(s => s.dispatch.getFeaturedBots)
  // load featured bots on first render
  React.useEffect(() => {
    // TODO likely don't do this all the time, just once
    getFeaturedBots()
  }, [getFeaturedBots])
  if (p.blocked) {
    return (
      <Kb.Box2 gap="tiny" centerChildren={true} direction="horizontal" fullWidth={true}>
        <Kb.Button
          key="Manage blocking"
          mode="Secondary"
          type="Danger"
          label="Manage blocking"
          onClick={p.onManageBlocking}
        />
      </Kb.Box2>
    )
  }

  let buttons: Array<React.ReactNode> = []

  const dropdown = (
    <DropdownButton
      blockedOrHidFromFollowers={p.blocked || p.hidFromFollowers}
      key="dropdown"
      isBot={p.isBot}
      onAddToTeam={p.onAddToTeam}
      onOpenPrivateFolder={p.onOpenPrivateFolder}
      onBrowsePublicFolder={p.onBrowsePublicFolder}
      onInstallBot={p.onInstallBot}
      onUnfollow={p.followThem && p.state !== 'valid' ? p.onUnfollow : undefined}
      onManageBlocking={p.onManageBlocking}
    />
  )

  const chatButton = <ChatButton key="Chat" username={p.username} />

  if (p.state === 'notAUserYet') {
    buttons = [
      chatButton,
      <Kb.Button key="Open folder" mode="Secondary" label="Open folder" onClick={p.onOpenPrivateFolder} />,
    ]
  } else if (p.onEditProfile) {
    buttons = [
      <Kb.Button key="Edit profile" mode="Secondary" label="Edit profile" onClick={p.onEditProfile} />,
      chatButton,
    ]
  } else if (p.followThem) {
    if (p.state === 'valid') {
      buttons = [
        <FollowButton
          key="Unfollow"
          following={true}
          onUnfollow={p.onUnfollow}
          waitingKey={Constants.waitingKey}
        />,
        chatButton,
        dropdown,
      ]
    } else if (p.state === 'needsUpgrade') {
      buttons = [
        chatButton,
        <Kb.WaitingButton
          key="Accept"
          type="Success"
          label="Accept"
          waitingKey={Constants.waitingKey}
          onClick={p.onAccept}
        />,
        dropdown,
      ]
    } else {
      buttons = [
        <Kb.WaitingButton
          key="Reload"
          label="Reload"
          waitingKey={Constants.waitingKey}
          onClick={p.onReload}
        />,
        <Kb.WaitingButton
          key="Accept"
          type="Success"
          label="Accept"
          waitingKey={Constants.waitingKey}
          onClick={p.onAccept}
        />,
        dropdown,
      ]
    }
  } else {
    if (p.state === 'error') {
      buttons = [
        <Kb.WaitingButton
          key="Reload"
          label="Reload"
          waitingKey={Constants.waitingKey}
          onClick={p.onReload}
        />,
        chatButton,
        dropdown,
      ]
    } else {
      buttons = [
        <FollowButton
          key="Follow"
          following={false}
          followsYou={p.followsYou}
          onFollow={p.onFollow}
          waitingKey={Constants.waitingKey}
        />,
        chatButton,
        dropdown,
      ]
    }
  }

  return (
    <Kb.Box2 gap="tiny" centerChildren={true} direction="horizontal" fullWidth={true}>
      {p.state === 'checking' ? <Kb.ProgressIndicator type="Small" /> : buttons}
    </Kb.Box2>
  )
}

const DropdownButton = (p: DropdownProps) => {
  const {onInstallBot, onAddToTeam, onBrowsePublicFolder, onUnfollow} = p
  const {onManageBlocking, blockedOrHidFromFollowers, isBot, onOpenPrivateFolder} = p
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
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
          onHidden={toggleShowingPopup}
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
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.ClickableBox onClick={toggleShowingPopup} ref={popupAnchor}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
        <Kb.Button onClick={undefined} mode="Secondary" style={styles.dropdownButton}>
          <Kb.Icon color={Styles.globalColors.blue} type="iconfont-ellipsis" />
        </Kb.Button>
      </Kb.Box2>
      {popup}
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  chatIcon: {marginRight: Styles.globalMargins.tiny},
  dropdownButton: {minWidth: undefined},
}))

export default Actions
