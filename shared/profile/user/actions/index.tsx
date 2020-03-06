import * as Constants from '../../../constants/tracker2'
import * as BotsGen from '../../../actions/bots-gen'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/tracker2'
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
  onRequestLumens: () => void
  onSendLumens: () => void
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
  | 'onSendLumens'
  | 'onRequestLumens'
  | 'onManageBlocking'
> & {
  blockedOrHidFromFollowers: boolean
  onUnfollow?: () => void
}

const Actions = (p: Props) => {
  const dispatch = Container.useDispatch()
  // load featured bots on first render
  React.useEffect(() => {
    dispatch(BotsGen.createGetFeaturedBots({}))
  }, [dispatch])
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
      onSendLumens={p.onSendLumens}
      onRequestLumens={p.onRequestLumens}
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

const DropdownButton = Kb.OverlayParentHOC((p: Kb.PropsWithOverlay<DropdownProps>) => {
  const items: Kb.MenuItems = [
    p.isBot
      ? {icon: 'iconfont-nav-2-robot', onClick: p.onInstallBot, title: 'Install bot in team or chat'}
      : {icon: 'iconfont-people', onClick: p.onAddToTeam, title: 'Add to team...'},
    {icon: 'iconfont-stellar-send', onClick: p.onSendLumens, title: 'Send Lumens (XLM)'},
    {icon: 'iconfont-stellar-request', onClick: p.onRequestLumens, title: 'Request Lumens (XLM)'},
    {icon: 'iconfont-folder-open', onClick: p.onOpenPrivateFolder, title: 'Open private folder'},
    {icon: 'iconfont-folder-public', onClick: p.onBrowsePublicFolder, title: 'Browse public folder'},
    p.onUnfollow && {icon: 'iconfont-wave', onClick: p.onUnfollow && p.onUnfollow, title: 'Unfollow'},
    {
      danger: true,
      icon: 'iconfont-remove',
      onClick: p.onManageBlocking,
      title: p.blockedOrHidFromFollowers ? 'Manage blocking' : 'Block',
    },
  ].reduce<Kb.MenuItems>((arr, i) => {
    i && arr.push(i as Kb.MenuItem)
    return arr
  }, [])

  return (
    <Kb.ClickableBox onClick={p.toggleShowingMenu} ref={p.setAttachmentRef}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
        <Kb.Button onClick={undefined} mode="Secondary" style={styles.dropdownButton}>
          <Kb.Icon color={Styles.globalColors.blue} type="iconfont-ellipsis" />
        </Kb.Button>
      </Kb.Box2>
      <Kb.FloatingMenu
        closeOnSelect={true}
        attachTo={p.getAttachmentRef}
        items={items}
        onHidden={p.toggleShowingMenu}
        position="bottom right"
        visible={p.showingMenu}
      />
    </Kb.ClickableBox>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  chatIcon: {marginRight: Styles.globalMargins.tiny},
  dropdownButton: {minWidth: undefined},
}))

export default Actions
