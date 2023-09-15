import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Platforms from '../../../constants/platform'

export type Props = {
  appendNewChatBuilder: () => void
  filter: string
  isSearching: boolean
  onBack: () => void
  onEnsureSelection: () => void
  onNewChat?: (() => void) | null
  onSelectDown: () => void
  onSelectUp: () => void
  onSetFilter: (filter: string) => void
  onStartSearch: () => void
  onStopSearch: () => void
  showNewChat: boolean
  showSearch: boolean
  style?: Kb.Styles.StylesCrossPlatform
}

class ConversationFilterInput extends React.PureComponent<Props> {
  private input = React.createRef<Kb.SearchFilter>()

  private onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.props.onStopSearch()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      this.props.onSelectDown()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      this.props.onSelectUp()
    }
  }

  private onEnterKeyDown = (e?: React.BaseSyntheticEvent) => {
    if (!Kb.Styles.isMobile) {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }
      this.props.onEnsureSelection()
      this.input.current && this.input.current.blur()
    }
  }

  private onChange = (q: string) => {
    if (q !== this.props.filter) {
      this.props.onSetFilter(q)
    }
  }

  private hotKeys = ['mod+n']
  private onHotKeys = () => {
    this.props.appendNewChatBuilder()
  }

  componentDidUpdate(prevProps: Props) {
    if (!prevProps.isSearching && this.props.isSearching) {
      this.input.current && this.input.current.focus()
    }
  }

  render() {
    const searchInput = (
      <Kb.SearchFilter
        ref={this.input}
        size="full-width"
        style={styles.searchBox}
        icon="iconfont-search"
        placeholderText={
          this.props.isSearching
            ? 'Search your chats...'
            : Kb.Styles.isMobile
            ? 'Search your chats'
            : 'Search'
        }
        hotkey="k"
        showXOverride={this.props.isSearching ? true : undefined}
        value={this.props.filter}
        valueControlled={true}
        // On mobile SearchFilter is re-mounted when toggling isSearching. (See chat/inbox/index.native.tsx:render's use of isSearching)
        // Simple props would cause the keyboard to appear and then disappear on dismount.
        // Take care instead to only launch the keyboard from the isSearching=true mountpoint.
        dummyInput={Kb.Styles.isMobile && !this.props.isSearching}
        focusOnMount={Kb.Styles.isMobile && this.props.isSearching}
        onChange={this.onChange}
        onCancel={this.props.onStopSearch}
        onFocus={this.props.onStartSearch}
        onKeyDown={this.onKeyDown}
        onEnterKeyDown={this.onEnterKeyDown}
      />
    )
    return (
      <Kb.Box2
        direction="horizontal"
        centerChildren={!Kb.Styles.isTablet}
        gap={Kb.Styles.isMobile ? 'small' : 'xtiny'}
        style={Kb.Styles.collapseStyles([
          styles.containerNotFiltering,
          Kb.Styles.isPhone ? null : Kb.Styles.isTablet && this.props.showSearch ? null : styles.whiteBg,
          !Kb.Styles.isMobile && styles.whiteBg,
          this.props.style,
        ])}
        gapStart={this.props.showSearch}
        gapEnd={true}
      >
        {!Kb.Styles.isMobile && <Kb.HotKey hotKeys={this.hotKeys} onHotKey={this.onHotKeys} />}
        {this.props.showSearch && searchInput}
        {!!this.props.onNewChat && !Kb.Styles.isPhone && (Kb.Styles.isTablet || !this.props.isSearching) && (
          <Kb.Box style={styles.rainbowBorder}>
            <Kb.WithTooltip position="top center" tooltip={`(${Platforms.shortcutSymbol}N)`}>
              <Kb.Button
                small={true}
                label="New chat"
                onClick={this.props.onNewChat}
                style={styles.newChatButton}
              />
            </Kb.WithTooltip>
          </Kb.Box>
        )}
      </Kb.Box2>
    )
  }
}

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
        isPhone: {
          backgroundColor: Kb.Styles.globalColors.white,
        },
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
      newChatButton: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
          paddingRight: Kb.Styles.globalMargins.xsmall,
        },
      }),
      newChatButtonText: {
        color: Kb.Styles.globalColors.white,
        marginRight: Kb.Styles.globalMargins.xtiny,
      },
      newIcon: {
        position: 'relative',
        top: 1,
      },
      rainbowBorder: Kb.Styles.platformStyles({
        common: {
          padding: 2,
        },
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
