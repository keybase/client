import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'

type OwnProps = {
  onEnsureSelection: () => void
  onSelectDown: () => void
  onSelectUp: () => void
  onQueryChanged: (arg0: string) => void
  query: string
  showNewChat: boolean
  showSearch: boolean
}


const ConversationFilterInput = React.memo(function ConversationFilterInput(ownProps: OwnProps) {
  const {onEnsureSelection, onSelectDown, onSelectUp, showSearch} = ownProps
  const {onQueryChanged: onSetFilter, query: filter} = ownProps

  const isSearching = Chat.useChatState(s => !!s.inboxSearch)

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const toggleInboxSearch = Chat.useChatState(s => s.dispatch.toggleInboxSearch)
  const onStartSearch = React.useCallback(() => {
    toggleInboxSearch(true)
  }, [toggleInboxSearch])
  const onStopSearch = React.useCallback(() => {
    toggleInboxSearch(false)
  }, [toggleInboxSearch])

  const inputRef = React.useRef<Kb.SearchFilterRef>(null)

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onStopSearch()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        onSelectDown()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        onSelectUp()
      }
    },
    [onStopSearch, onSelectDown, onSelectUp]
  )

  const onEnterKeyDown = React.useCallback(
    (e?: React.BaseSyntheticEvent) => {
      if (!Kb.Styles.isMobile) {
        if (e) {
          e.preventDefault()
          e.stopPropagation()
        }
        onEnsureSelection()
        inputRef.current?.blur()
      }
    },
    [onEnsureSelection]
  )

  const onChange = React.useCallback(
    (q: string) => {
      if (q !== filter) {
        onSetFilter(q)
      }
    },
    [onSetFilter, filter]
  )

  const onHotKeys = React.useCallback(() => {
    appendNewChatBuilder()
  }, [appendNewChatBuilder])
  Kb.useHotKey('mod+n', onHotKeys)

  React.useEffect(() => {
    if (isSearching) {
      inputRef.current?.focus()
    }
  }, [isSearching])

  const searchInput = (
    <Kb.SearchFilter
      ref={inputRef}
      size="full-width"
      style={styles.searchBox}
      icon="iconfont-search"
      placeholderText="Search"
      hotkey="k"
      showXOverride={isSearching ? true : undefined}
      value={filter}
      valueControlled={true}
      // On mobile SearchFilter is re-mounted when toggling isSearching. (See chat/inbox/index.native.tsx:render's use of isSearching)
      // Simple props would cause the keyboard to appear and then disappear on dismount.
      // Take care instead to only launch the keyboard from the isSearching=true mountpoint.
      dummyInput={Kb.Styles.isMobile && !isSearching}
      focusOnMount={Kb.Styles.isMobile && isSearching}
      onChange={onChange}
      onCancel={onStopSearch}
      onFocus={onStartSearch}
      onKeyDown={onKeyDown}
      onEnterKeyDown={onEnterKeyDown}
    />
  )
  return (
    <Kb.Box2
      direction="horizontal"
      centerChildren={!Kb.Styles.isTablet}
      gap={Kb.Styles.isMobile ? 'small' : showSearch ? 'xtiny' : undefined}
      style={Kb.Styles.collapseStyles([
        styles.containerNotFiltering,
        Kb.Styles.isPhone ? null : Kb.Styles.isTablet && showSearch ? null : styles.whiteBg,
        !Kb.Styles.isMobile && styles.whiteBg,
      ])}
      gapStart={showSearch}
      gapEnd={showSearch}
    >
      {showSearch && searchInput}
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      containerNotFiltering: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          height: undefined,
          position: 'relative',
          width: '100%',
        },
        isElectron: {
          alignSelf: 'stretch',
          flexGrow: 1,
          marginLeft: Kb.Styles.globalMargins.tiny,
          marginRight: Kb.Styles.globalMargins.tiny,
          width: undefined,
        },
        isPhone: {backgroundColor: Kb.Styles.globalColors.white},
      }),
      searchBox: Kb.Styles.platformStyles({
        common: {flex: 1},
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
        // hacky, redo the layout of this component later
        isTablet: {maxWidth: 270 - 16 * 2},
      }),
      whiteBg: {backgroundColor: Kb.Styles.globalColors.white},
    }) as const
)

export default ConversationFilterInput
