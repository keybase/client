import * as Constants from '../../../constants/tracker2'
import * as ChatConstants from '../../../constants/chat2'
import * as Kb from '../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/tracker2'
import FollowButton from './follow-button'

type Props = {
  followThem: boolean
  followsYou: boolean
  blocked: boolean
  onAccept: () => void
  onAddToTeam: () => void
  onBrowsePublicFolder: () => void
  onChat: () => void
  onEditProfile: () => void | null
  onFollow: () => void
  onIgnoreFor24Hours: () => void
  onOpenPrivateFolder: () => void
  onReload: () => void
  onRequestLumens: () => void
  onSendLumens: () => void
  onUnfollow: () => void
  onBlock: () => void
  onUnblock: () => void
  state: Types.DetailsState
}

type DropdownProps = Pick<
  Props,
  'onAddToTeam' | 'onOpenPrivateFolder' | 'onBrowsePublicFolder' | 'onSendLumens' | 'onRequestLumens' | 'onBlock' | 'onUnblock' | 'blocked'
> & {onUnfollow?: () => void}

const Actions = (p: Props) => {
  let buttons = []

  const dropdown = (
    <DropdownButton
      key="dropdown"
      onAddToTeam={p.onAddToTeam}
      onOpenPrivateFolder={p.onOpenPrivateFolder}
      onBrowsePublicFolder={p.onBrowsePublicFolder}
      onSendLumens={p.onSendLumens}
      onRequestLumens={p.onRequestLumens}
      onBlock={p.onBlock}
      onUnblock={p.onUnblock}
      blocked={p.blocked}
    />
  )

  const chatButton = (
    <Kb.WaitingButton
      key="Chat"
      label="Chat"
      waitingKey={ChatConstants.waitingKeyCreating}
      onClick={p.onChat}
    >
      <Kb.Icon type="iconfont-chat" color={Styles.globalColors.white} style={styles.chatIcon} />
    </Kb.WaitingButton>
  )

  if (p.state === 'notAUserYet') {
    buttons = [
      chatButton,
      <Kb.Button key="Open folder" mode="Secondary" label="Open folder" onClick={p.onOpenPrivateFolder} />,
    ]
  } else if (p.onEditProfile) {
    buttons = [
      <Kb.Button key="Edit profile" mode="Secondary" label="Edit profile" onClick={p.onEditProfile} />,
    ]
  } else if (p.followThem) {
    if (p.state === 'valid') {
      buttons = [
        <FollowButton
          key="unfollow"
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
          type="Success"
          key="Accept"
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
          key="follow"
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
  const items = [
    {onClick: p.onAddToTeam, title: 'Add to team...'},
    {newTag: true, onClick: p.onSendLumens, title: 'Send Lumens (XLM)'},
    {newTag: true, onClick: p.onRequestLumens, title: 'Request Lumens (XLM)'},
    !Styles.isMobile ? {onClick: p.onOpenPrivateFolder, title: 'Open private folder'} : null,
    !Styles.isMobile ? {onClick: p.onBrowsePublicFolder, title: 'Browse public folder'} : null,
    p.blocked ? {danger: true, onClick: p.onUnblock, title: 'Unblock'} : {danger: true, onClick: p.onBlock, title: 'Block'},
  ].filter(Boolean)

  return (
    <Kb.ClickableBox onClick={p.toggleShowingMenu} ref={p.setAttachmentRef}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
        <Kb.Button onClick={null} mode="Secondary" style={styles.dropdownButton}>
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

const styles = Styles.styleSheetCreate({
  chatIcon: {marginRight: Styles.globalMargins.tiny},
  dropdownButton: {minWidth: undefined},
})

export default Actions
