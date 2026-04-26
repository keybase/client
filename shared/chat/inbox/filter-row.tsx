import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'

type OwnProps = {
  isSearching: boolean
  onCancelSearch: () => void
  onEnsureSelection: () => void
  onSelectDown: () => void
  onSelectUp: () => void
  onQueryChanged: (arg0: string) => void
  query: string
  showSearch: boolean
  startSearch: () => void
}

function ConversationFilterInput(ownProps: OwnProps) {
  const {isSearching, onCancelSearch, onEnsureSelection, onSelectDown, onSelectUp, showSearch} = ownProps
  const {onQueryChanged: onSetFilter, query: filter} = ownProps

  const appendNewChatBuilder = C.Router2.appendNewChatBuilder
  const {startSearch} = ownProps

  const inputRef = React.useRef<Kb.SearchFilterRef>(null)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancelSearch()
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
  Kb.useHotKey('mod+k', startSearch)

  React.useEffect(() => {
    if (isSearching) {
      inputRef.current?.focus()
    }
  }, [isSearching])
  const gap = Kb.Styles.isMobile ? 'small' : showSearch ? 'xtiny' : undefined

  const searchInput = isSearching ? (
    <Kb.SearchFilter
      ref={inputRef}
      size="full-width"
      style={styles.searchBox}
      icon="iconfont-search"
      placeholderText="Search"
      showXOverride={true}
      value={filter}
      valueControlled={true}
      focusOnMount={Kb.Styles.isMobile}
      onChange={onChange}
      onCancel={onCancelSearch}
      onKeyDown={onKeyDown}
      onEnterKeyDown={onEnterKeyDown}
    />
  ) : (
    <Kb.Box2 direction="horizontal" style={styles.searchPlaceholderOuter} alignItems="center">
      <Kb.ClickableBox2 onClick={startSearch} style={styles.searchPlaceholder}>
        <Kb.Icon
          type="iconfont-search"
          sizeType={Kb.Styles.isMobile ? 'Small' : 'Default'}
          color={Kb.Styles.globalColors.black_50}
          style={styles.searchPlaceholderIcon}
        />
        <Kb.Text type="BodySemibold" style={styles.searchPlaceholderText}>
          {Kb.Styles.isMobile ? 'Search' : 'Search (\u2318K)'}
        </Kb.Text>
      </Kb.ClickableBox2>
    </Kb.Box2>
  )
  return (
    <Kb.Box2
      direction="horizontal"
      centerChildren={!Kb.Styles.isTablet}
      {...(gap === undefined ? {} : {gap})}
      style={Kb.Styles.collapseStyles([
        styles.containerNotFiltering,
        !Kb.Styles.isPhone && styles.whiteBg,
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
        ...Kb.Styles.globalStyles.flexBoxRow,
        ...Kb.Styles.globalStyles.flexGrow,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        flex: 1,
        flexShrink: 1,
        height: 32,
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.xsmall,
      },
      searchPlaceholderIcon: Kb.Styles.platformStyles({
        isElectron: {marginRight: Kb.Styles.globalMargins.tiny, marginTop: 2},
        isMobile: {marginRight: Kb.Styles.globalMargins.tiny},
      }),
      searchPlaceholderOuter: Kb.Styles.platformStyles({
        common: {flex: 1},
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isTablet: {paddingLeft: 0, paddingRight: 0},
      }),
      searchPlaceholderText: {color: Kb.Styles.globalColors.black_50},
      whiteBg: {backgroundColor: Kb.Styles.globalColors.white},
    }) as const
)

export default ConversationFilterInput
