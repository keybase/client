import * as C from '@/constants'
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

const hotKeys = ['mod+n']

const ConversationFilterInput = React.memo(function ConversationFilterInput(ownProps: OwnProps) {
  const {
    onEnsureSelection,
    onSelectDown,
    onSelectUp,
    onQueryChanged: onSetFilter,
    query: filter,
    showSearch,
  } = ownProps

  const isSearching = C.useChatState(s => !!s.inboxSearch)

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const toggleInboxSearch = C.useChatState(s => s.dispatch.toggleInboxSearch)
  const onStartSearch = React.useCallback(() => {
    toggleInboxSearch(true)
  }, [toggleInboxSearch])
  const onStopSearch = React.useCallback(() => {
    toggleInboxSearch(false)
  }, [toggleInboxSearch])

  const inputRef = React.useRef<Kb.SearchFilter>(null)

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

  const [lastSearching, setLastSearching] = React.useState(isSearching)
  if (lastSearching !== isSearching) {
    setLastSearching(isSearching)
    if (isSearching) {
      inputRef.current?.focus()
    }
  }

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
      gap={Kb.Styles.isMobile ? 'small' : 'xtiny'}
      style={Kb.Styles.collapseStyles([
        styles.containerNotFiltering,
        Kb.Styles.isPhone ? null : Kb.Styles.isTablet && showSearch ? null : styles.whiteBg,
        !Kb.Styles.isMobile && styles.whiteBg,
      ])}
      gapStart={showSearch}
      gapEnd={true}
    >
      {!Kb.Styles.isMobile && <Kb.HotKey hotKeys={hotKeys} onHotKey={onHotKeys} />}
      {showSearch && searchInput}
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      containerFiltering: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          position: 'relative',
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
          height: 39,
        },
        isMobile: {
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small, 0, Kb.Styles.globalMargins.xsmall),
          height: 48,
        },
        isPhone: {backgroundColor: Kb.Styles.globalColors.fastBlank},
      }),
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
      filterContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          backgroundColor: Kb.Styles.globalColors.black_10,
          borderRadius: Kb.Styles.borderRadius,
          flexGrow: 1,
          justifyContent: 'flex-start',
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.editable,
          height: 28,
          paddingLeft: 8,
        },
        isMobile: {
          height: 32,
          paddingLeft: 10,
        },
      }),
      flexOne: {flex: 1},
      icon: Kb.Styles.platformStyles({
        common: {position: 'relative'},
        isElectron: {top: 1},
        isMobile: {top: 0},
      }),
      input: {
        color: Kb.Styles.globalColors.black_50,
        position: 'relative',
        top: 1,
      },
      newChatButtonText: {
        color: Kb.Styles.globalColors.white,
        marginRight: Kb.Styles.globalMargins.xtiny,
      },
      newIcon: {
        position: 'relative',
        top: 1,
      },
      rainbowBorder: Kb.Styles.platformStyles({
        common: {padding: 2},
        isElectron: {
          background: Kb.Styles.isDarkMode()
            ? 'linear-gradient(rgba(255, 93, 93, 0.75), rgba(255, 247, 90, 0.75) 50%, rgba(58, 255, 172, 0.75))'
            : 'linear-gradient(180deg, #ff5d5d, #fff75a 50%, #3AFFAC)',
          borderRadius: 6,
        },
        isMobile: {borderRadius: 8},
      }),
      searchBox: Kb.Styles.platformStyles({
        common: {flex: 1},
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
        // hacky, redo the layout of this component later
        isTablet: {maxWidth: 270 - 16 * 2},
      }),
      text: Kb.Styles.platformStyles({
        common: {
          color: Kb.Styles.globalColors.black_50,
          marginRight: Kb.Styles.globalMargins.xtiny,
          position: 'relative',
        },
        isElectron: {
          marginLeft: Kb.Styles.globalMargins.xtiny,
          top: 0,
        },
        isMobile: {
          marginLeft: Kb.Styles.globalMargins.tiny,
          top: 1,
        },
      }),
      textFaint: {
        color: Kb.Styles.globalColors.black_35,
        position: 'relative',
      },
      whiteBg: {backgroundColor: Kb.Styles.globalColors.white},
    }) as const
)

export default ConversationFilterInput
