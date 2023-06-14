import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as ConfigConstants from '../../constants/config'
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
  const keybaseUsername: string | undefined = props.services['keybase']
  const serviceUsername = props.services[props.resultForService]

  // action button specific definitions
  const dispatch = Container.useDispatch()
  const myUsername = ConfigConstants.useConfigState(s => s.username)
  const blocked = Container.useSelector(state => state.users.blockMap.get(keybaseUsername || '')?.chatBlocked)
  const decoratedUsername = keybaseUsername ? keybaseUsername : `${serviceUsername}@${props.resultForService}`

  const onMenuAddToTeam = React.useCallback(() => {
    keybaseUsername &&
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {username: keybaseUsername}, selected: 'profileAddToTeam'}],
        })
      )
  }, [dispatch, keybaseUsername])

  const onOpenPrivateFolder = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(
      FsConstants.makeActionForOpenPathInFilesTab(
        FsTypes.stringToPath(`/keybase/private/${decoratedUsername},${myUsername}`)
      )
    )
  }, [dispatch, decoratedUsername, myUsername])

  const onBrowsePublicFolder = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(
      FsConstants.makeActionForOpenPathInFilesTab(
        FsTypes.stringToPath(`/keybase/public/${decoratedUsername}`)
      )
    )
  }, [dispatch, decoratedUsername])

  const onManageBlocking = React.useCallback(() => {
    keybaseUsername &&
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {username: keybaseUsername}, selected: 'chatBlockingModal'}],
        })
      )
  }, [dispatch, keybaseUsername])

  const onChat = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(Chat2Gen.createPreviewConversation({participants: [decoratedUsername], reason: 'search'}))
  }, [dispatch, decoratedUsername])

  const onSendLumens = React.useCallback(() => {
    keybaseUsername &&
      dispatch(
        WalletsGen.createOpenSendRequestForm({
          from: WalletsType.noAccountID,
          isRequest: false,
          recipientType: 'keybaseUser',
          to: keybaseUsername,
        })
      )
  }, [dispatch, keybaseUsername])

  const onRequestLumens = React.useCallback(() => {
    keybaseUsername &&
      dispatch(
        WalletsGen.createOpenSendRequestForm({
          from: WalletsType.noAccountID,
          isRequest: true,
          recipientType: 'keybaseUser',
          to: keybaseUsername,
        })
      )
  }, [dispatch, keybaseUsername])

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
  const {onAddToTeam, onSendLumens, onRequestLumens} = p
  const {onOpenPrivateFolder, onBrowsePublicFolder, onManageBlocking, blocked} = p
  const items: Kb.MenuItems = React.useMemo(
    () =>
      [
        onAddToTeam && {icon: 'iconfont-add', onClick: onAddToTeam, title: 'Add to team...'},
        onSendLumens && {icon: 'iconfont-stellar-send', onClick: onSendLumens, title: 'Send Lumens (XLM)'},
        onRequestLumens && {
          icon: 'iconfont-stellar-request',
          onClick: onRequestLumens,
          title: 'Request Lumens (XLM)',
        },
        onOpenPrivateFolder && {
          icon: 'iconfont-folder-open',
          onClick: onOpenPrivateFolder,
          title: 'Open private folder',
        },
        onBrowsePublicFolder && {
          icon: 'iconfont-folder-public',
          onClick: onBrowsePublicFolder,
          title: 'Browse public folder',
        },
        onManageBlocking && {
          danger: true,
          icon: 'iconfont-add',
          onClick: onManageBlocking,
          title: blocked ? 'Manage blocking' : 'Block',
        },
      ].reduce<Kb.MenuItems>((arr, i) => {
        i && arr.push(i as Kb.MenuItem)
        return arr
      }, []),
    [
      blocked,
      onAddToTeam,
      onBrowsePublicFolder,
      onManageBlocking,
      onOpenPrivateFolder,
      onRequestLumens,
      onSendLumens,
    ]
  )

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
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
    [items]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

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
