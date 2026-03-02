import * as C from '@/constants'
import * as Chat from '@/stores/chat'
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


function ConversationFilterInput(ownProps: OwnProps) {
  const {onEnsureSelection, onSelectDown, onSelectUp, showSearch} = ownProps
  const {onQueryChanged: onSetFilter, query: filter} = ownProps

  const isSearching = Chat.useChatState(s => !!s.inboxSearch)

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const toggleInboxSearch = Chat.useChatState(s => s.dispatch.toggleInboxSearch)
  const onStartSearch = () => {
    toggleInboxSearch(true)
  }
  const onStopSearch = () => {
    toggleInboxSearch(false)
  }

  const inputRef = React.useRef<Kb.SearchFilterRef>(null)

  const onKeyDown = (e: React.KeyboardEvent) => {
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
  }

  const onEnterKeyDown = (e?: React.BaseSyntheticEvent) => {
    if (!Kb.Styles.isMobile) {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }
      onEnsureSelection()
      inputRef.current?.blur()
    }
  }

  const onChange = (q: string) => {
    if (q !== filter) {
      onSetFilter(q)
    }
  }

  const onHotKeys = () => {
    appendNewChatBuilder()
  }
  Kb.useHotKey('mod+n', onHotKeys)

  React.useEffect(() => {
    if (isSearching) {
      inputRef.current?.focus()
    }
  }, [isSearching])

  // On mobile, SearchFilter is re-mounted when toggling isSearching
  // (see chat/inbox/index.native.tsx). To avoid keyboard flicker, render
  // a simple placeholder that triggers search on tap when not searching.
  const searchInput =
    Kb.Styles.isMobile && !isSearching ? (
      <Kb.ClickableBox2 onClick={onStartSearch} style={Kb.Styles.collapseStyles([styles.searchBox, styles.searchPlaceholder])}>
        <Kb.Box2 direction="horizontal" alignItems="center" alignSelf="flex-start" gap="tiny">
          <Kb.Icon type="iconfont-search" sizeType="Small" color={Kb.Styles.globalColors.black_50} />
          <Kb.Text type="BodySemibold" style={styles.searchPlaceholderText}>Search</Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox2>
    ) : (
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
}

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
      searchPlaceholder: {
        backgroundColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        height: 32,
        justifyContent: 'center',
        marginBottom: Kb.Styles.globalMargins.tiny,
        marginTop: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.xsmall,
      },
      searchPlaceholderText: {color: Kb.Styles.globalColors.black_50},
      whiteBg: {backgroundColor: Kb.Styles.globalColors.white},
    }) as const
)

export default ConversationFilterInput
