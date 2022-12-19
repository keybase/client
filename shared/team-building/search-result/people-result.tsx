import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as WalletsGen from '../../actions/wallets-gen'
import * as WalletsType from '../../constants/types/wallets'
import * as ChatConstants from '../../constants/chat2'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import CommonResult, {type ResultProps} from './common-result'

/*
 * This component is intended to be a drop-in replacement for UserResult.
 * It replaces the team-builder checkbox with a 'chat' button and action menu on desktop.
 * It retains most of the display code and logic from UserResult, but also includes
 * a bunch of React hooks to handle all the stateful logic needed to make the menu and chat button work.
 */

const PeopleResult = React.memo(function PeopleResult(props: ResultProps) {
  const keybaseUsername: string | null = props.services['keybase'] || null
  const serviceUsername = props.services[props.resultForService]

  // action button specific definitions
  const dispatch = Container.useDispatch()
  const myUsername = Container.useSelector(state => state.config.username)
  const blocked = Container.useSelector(state => state.users.blockMap.get(keybaseUsername || '')?.chatBlocked)
  const decoratedUsername = keybaseUsername ? keybaseUsername : `${serviceUsername}@${props.resultForService}`

  const onMenuAddToTeam = () =>
    keybaseUsername &&
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {username: keybaseUsername}, selected: 'profileAddToTeam'}],
      })
    )
  const onOpenPrivateFolder = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(
      FsConstants.makeActionForOpenPathInFilesTab(
        FsTypes.stringToPath(`/keybase/private/${decoratedUsername},${myUsername}`)
      )
    )
  }
  const onBrowsePublicFolder = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(
      FsConstants.makeActionForOpenPathInFilesTab(
        FsTypes.stringToPath(`/keybase/public/${decoratedUsername}`)
      )
    )
  }

  const onManageBlocking = () =>
    keybaseUsername &&
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {username: keybaseUsername}, selected: 'chatBlockingModal'}],
      })
    )
  const onChat = () => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(Chat2Gen.createPreviewConversation({participants: [decoratedUsername], reason: 'search'}))
  }
  const onSendLumens = () =>
    keybaseUsername &&
    dispatch(
      WalletsGen.createOpenSendRequestForm({
        from: WalletsType.noAccountID,
        isRequest: false,
        recipientType: 'keybaseUser',
        to: keybaseUsername,
      })
    )
  const onRequestLumens = () =>
    keybaseUsername &&
    dispatch(
      WalletsGen.createOpenSendRequestForm({
        from: WalletsType.noAccountID,
        isRequest: true,
        recipientType: 'keybaseUser',
        to: keybaseUsername,
      })
    )

  const resultIsMe = keybaseUsername === myUsername
  const dropdown = keybaseUsername ? (
    <DropdownButton
      key="dropdown"
      onAddToTeam={onMenuAddToTeam}
      onBrowsePublicFolder={onBrowsePublicFolder}
      onManageBlocking={!resultIsMe ? onManageBlocking : undefined}
      onOpenPrivateFolder={onOpenPrivateFolder}
      onRequestLumens={onRequestLumens}
      onSendLumens={onSendLumens}
      blocked={blocked}
    />
  ) : (
    <DropdownButton
      // if a result doesn't include a keybase account, the only action we can show is opening private folder
      key="dropdown"
      onOpenPrivateFolder={onOpenPrivateFolder}
    />
  )

  const chatButton = (
    <Kb.WaitingButton
      key="Chat"
      label="Chat"
      small={true}
      waitingKey={ChatConstants.waitingKeyCreating}
      onClick={e => {
        e.stopPropagation() // instead of using onAdd, use onChat logic
        onChat()
      }}
    >
      <Kb.Icon type="iconfont-chat" color={Styles.globalColors.whiteOrWhite} style={styles.chatIcon} />
    </Kb.WaitingButton>
  )

  const rightButtons = Styles.isMobile ? [] : [chatButton, dropdown] // don't show action buttons on mobile for space reasons

  return <CommonResult {...props} rowStyle={styles.rowContainer} rightButtons={rightButtons} />
})
type DropdownProps = {
  onAddToTeam?: () => void
  onOpenPrivateFolder?: () => void
  onBrowsePublicFolder?: () => void
  onSendLumens?: () => void
  onRequestLumens?: () => void
  onManageBlocking?: () => void
  blocked?: boolean
  onUnfollow?: () => void
}

const DropdownButton = (p: DropdownProps) => {
  const items: Kb.MenuItems = [
    p.onAddToTeam && {icon: 'iconfont-add', onClick: p.onAddToTeam, title: 'Add to team...'},
    p.onSendLumens && {icon: 'iconfont-stellar-send', onClick: p.onSendLumens, title: 'Send Lumens (XLM)'},
    p.onRequestLumens && {
      icon: 'iconfont-stellar-request',
      onClick: p.onRequestLumens,
      title: 'Request Lumens (XLM)',
    },
    p.onOpenPrivateFolder && {
      icon: 'iconfont-folder-open',
      onClick: p.onOpenPrivateFolder,
      title: 'Open private folder',
    },
    p.onBrowsePublicFolder && {
      icon: 'iconfont-folder-public',
      onClick: p.onBrowsePublicFolder,
      title: 'Browse public folder',
    },
    p.onManageBlocking && {
      danger: true,
      icon: 'iconfont-add',
      onClick: p.onManageBlocking,
      title: p.blocked ? 'Manage blocking' : 'Block',
    },
  ].reduce<Kb.MenuItems>((arr, i) => {
    i && arr.push(i as Kb.MenuItem)
    return arr
  }, [])

  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      closeOnSelect={true}
      attachTo={attachTo}
      items={items}
      onHidden={toggleShowingPopup}
      position="bottom right"
      visible={showingPopup}
    />
  ))

  return (
    <Kb.ClickableBox
      onClick={e => {
        e.stopPropagation()
        toggleShowingPopup()
      }}
      ref={popupAnchor}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
        <Kb.Button onClick={undefined} mode="Secondary" style={styles.dropdownButton} small={true}>
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
  highlighted: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.blueLighter2,
      borderRadius: Styles.borderRadius,
    },
  }),
  rowContainer: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall),
  },
}))

export default PeopleResult
