import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as FS from '@/stores/fs'
import CommonResult, {type ResultProps} from './common-result'
import {useUsersState} from '@/stores/users'
import {useCurrentUserState} from '@/stores/current-user'

/*
 * This component is intended to be a drop-in replacement for UserResult.
 * It replaces the team-builder checkbox with a 'chat' button and action menu on desktop.
 * It retains most of the display code and logic from UserResult, but also includes
 * a bunch of React hooks to handle all the stateful logic needed to make the menu and chat button work.
 */

const PeopleResult = function PeopleResult(props: ResultProps) {
  const keybaseUsername: string | undefined = props.services['keybase']
  const serviceUsername = props.services[props.resultForService]

  // action button specific definitions
  const myUsername = useCurrentUserState(s => s.username)
  const blocked = useUsersState(s => s.blockMap.get(keybaseUsername || '')?.chatBlocked)
  const decoratedUsername = keybaseUsername ? keybaseUsername : `${serviceUsername}@${props.resultForService}`

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onMenuAddToTeam = () => {
    keybaseUsername && navigateAppend({name: 'profileAddToTeam', params: {username: keybaseUsername}})
  }

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onOpenPrivateFolder = () => {
    navigateUp()
    FS.navToPath(
      T.FS.stringToPath(`/keybase/private/${decoratedUsername},${myUsername}`)
    )
  }

  const onBrowsePublicFolder = () => {
    navigateUp()
    FS.navToPath(T.FS.stringToPath(`/keybase/public/${decoratedUsername}`))
  }

  const onManageBlocking = () => {
    keybaseUsername && navigateAppend({name: 'chatBlockingModal', params: {username: keybaseUsername}})
  }

  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const onChat = () => {
    navigateUp()
    previewConversation({participants: [decoratedUsername], reason: 'search'})
  }

  const resultIsMe = keybaseUsername === myUsername
  const dropdown = keybaseUsername ? (
    <DropdownButton
      key="dropdown"
      onAddToTeam={onMenuAddToTeam}
      onBrowsePublicFolder={onBrowsePublicFolder}
      onManageBlocking={!resultIsMe ? onManageBlocking : undefined}
      onOpenPrivateFolder={onOpenPrivateFolder}
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
      waitingKey={C.waitingKeyChatCreating}
      onClick={e => {
        e.stopPropagation() // instead of using onAdd, use onChat logic
        onChat()
      }}
    >
      <Kb.Icon2 type="iconfont-chat" color={Kb.Styles.globalColors.whiteOrWhite} style={styles.chatIcon} />
    </Kb.WaitingButton>
  )

  const rightButtons = Kb.Styles.isMobile ? [] : [chatButton, dropdown] // don't show action buttons on mobile for space reasons

  return <CommonResult {...props} rowStyle={styles.rowContainer} rightButtons={rightButtons} />
}
type DropdownProps = {
  onAddToTeam?: () => void
  onOpenPrivateFolder?: () => void
  onBrowsePublicFolder?: () => void
  onManageBlocking?: () => void
  blocked?: boolean
  onUnfollow?: () => void
}

const DropdownButton = (p: DropdownProps) => {
  const {onAddToTeam, onOpenPrivateFolder, onBrowsePublicFolder, onManageBlocking, blocked} = p
  const items: Kb.MenuItems = [
        onAddToTeam && {icon: 'iconfont-add', onClick: onAddToTeam, title: 'Add to team...'},
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
      }, [])

  const makePopup = (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
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
    <Kb.ClickableBox
      onClick={e => {
        e.stopPropagation()
        showPopup()
      }}
      ref={popupAnchor}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xsmall">
        <Kb.Button onClick={undefined} mode="Secondary" style={styles.dropdownButton} small={true}>
          <Kb.Icon2 color={Kb.Styles.globalColors.blue} type="iconfont-ellipsis" />
        </Kb.Button>
      </Kb.Box2>
      {popup}
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  chatIcon: {marginRight: Kb.Styles.globalMargins.tiny},
  dropdownButton: {minWidth: undefined},
  rowContainer: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
  },
}))

export default PeopleResult
