import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Platforms from '../constants/platform'
import Flags from '../util/feature-flags'

export type Props = {
  filter: string
  isLoading: boolean
  isSearching: boolean
  showNewTag: boolean
  onBack: () => void
  onEnsureSelection: () => void
  onNewChat?: () => void
  onSelectDown: () => void
  onSelectUp: () => void
  onSetFilter: (filter: string) => void
  onStartSearch: () => void
  onStopSearch: () => void
  style?: Styles.StylesCrossPlatform
}

class ConversationFilterInput extends React.PureComponent<Props> {
  _input: any

  _onKeyDown = (e: React.KeyboardEvent, isComposingIME: boolean) => {
    if (e.key === 'Escape' && !isComposingIME) {
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

  _onEnterKeyDown = (e?: React.BaseSyntheticEvent) => {
    if (!Styles.isMobile) {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }
      this.props.onEnsureSelection()
      this._input && this._input.blur()
    }
  }

  _onChange = (q: string) => {
    if (q !== this.props.filter) {
      this.props.onSetFilter(q)
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (!prevProps.isSearching && this.props.isSearching) {
      this._input && this._input.focus()
    }
  }

  _setRef = r => (this._input = r)

  render() {
    const searchInput = (
      <Kb.SearchFilter
        ref={this._setRef}
        style={styles.searchBox}
        icon="iconfont-search"
        placeholderText={
          this.props.isSearching ? 'Search your chats...' : Styles.isMobile ? 'Search your chats' : 'Search'
        }
        hotkey="k"
        showXOverride={this.props.isSearching ? true : null}
        value={this.props.filter}
        valueControlled={true}
        // On mobile SearchFilter is re-mounted when toggling isSearching. (See chat/inbox/index.native.tsx:render's use of isSearching)
        // Simple props would cause the keyboard to appear and then disappear on dismount.
        // Take care instead to only launch the keyboard from the isSearching=true mountpoint.
        dummyInput={Styles.isMobile && !this.props.isSearching}
        focusOnMount={Styles.isMobile && this.props.isSearching}
        onChange={this._onChange}
        onCancel={this.props.onStopSearch}
        onFocus={this.props.onStartSearch}
        onKeyDown={this._onKeyDown}
        onEnterKeyDown={this._onEnterKeyDown}
      />
    )
    const children = (
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        gap="tiny"
        style={Styles.collapseStyles([
          styles.containerNotFiltering,
          !Styles.isMobile && styles.whiteBg,
          this.props.style,
        ])}
        gapStart={true}
        gapEnd={true}
        fullWidth={true}
      >
        {searchInput}
        {!this.props.isSearching && !!this.props.onNewChat && !Styles.isMobile && (
          <Kb.Box style={Flags.wonderland ? styles.wonderlandBorder : {}}>
            <Kb.WithTooltip
              position="top center"
              text={
                Flags.wonderland
                  ? `(${Platforms.shortcutSymbol}N)`
                  : `New chat (${Platforms.shortcutSymbol}N)`
              }
            >
              <Kb.Button small={true} onClick={this.props.onNewChat} style={styles.newChatButton}>
                {Flags.wonderland ? (
                  <>
                    <Kb.Text type="BodyBig" style={styles.newChatButtonText}>
                      New chat
                    </Kb.Text>
                    <Kb.Emoji size={16} emojiName=":rabbit2:" />
                  </>
                ) : (
                  <Kb.Icon type="iconfont-compose" color={Styles.globalColors.white} style={styles.newIcon} />
                )}
              </Kb.Button>
            </Kb.WithTooltip>
          </Kb.Box>
        )}
      </Kb.Box2>
    )
    return (
      <>
        {children}
        {this.props.isLoading && Styles.isMobile && (
          <Kb.Box style={styles.loadingContainer}>
            <Kb.LoadingLine />
          </Kb.Box>
        )}
      </>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  containerFiltering: Styles.platformStyles({
    common: {position: 'relative'},
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
      ...Styles.padding(0, Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
      height: 39,
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small, 0, Styles.globalMargins.xsmall),
      backgroundColor: Styles.globalColors.fastBlank,
      height: 48,
    },
  }),
  containerNotFiltering: Styles.platformStyles({
    common: {
      height: undefined,
      position: 'relative',
    },
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.xtiny),
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isMobile: {
      backgroundColor: Styles.globalColors.fastBlank,
    },
  }),
  filterContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: Styles.globalColors.black_10,
      borderRadius: Styles.borderRadius,
      flexGrow: 1,
      justifyContent: 'flex-start',
    },
    isElectron: {
      ...Styles.desktopStyles.editable,
      height: 28,
      paddingLeft: 8,
    },
    isMobile: {
      height: 32,
      paddingLeft: 10,
    },
  }),
  flexOne: {flex: 1},
  icon: Styles.platformStyles({
    common: {position: 'relative'},
    isElectron: {top: 1},
    isMobile: {top: 0},
  }),
  input: {
    color: Styles.globalColors.black_50,
    position: 'relative',
    top: 1,
  },
  loadingContainer: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  newChatButton: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
      paddingRight: Flags.wonderland ? Styles.globalMargins.xtiny : Styles.globalMargins.xsmall,
    },
  }),
  newChatButtonText: {
    color: Styles.globalColors.white,
    marginRight: Styles.globalMargins.xtiny,
  },
  newIcon: {
    position: 'relative',
    top: 1,
  },
  searchBox: Styles.platformStyles({
    common: {flex: 1},
    isElectron: Styles.desktopStyles.windowDraggingClickable,
    isMobile: {...Styles.padding(Styles.globalMargins.tiny, 0)},
  }),
  text: Styles.platformStyles({
    common: {
      color: Styles.globalColors.black_50,
      marginRight: Styles.globalMargins.xtiny,
      position: 'relative',
    },
    isElectron: {
      marginLeft: Styles.globalMargins.xtiny,
      top: 0,
    },
    isMobile: {
      marginLeft: Styles.globalMargins.tiny,
      top: 1,
    },
  }),
  textFaint: {
    color: Styles.globalColors.black_35,
    position: 'relative',
  },
  whiteBg: {backgroundColor: Styles.globalColors.white},
  wonderlandBorder: Styles.platformStyles({
    common: {
      padding: 2,
    },
    isElectron: {
      background: 'linear-gradient(180deg, #ff5d5d, #fff75a 50%, #3AFFAC)',
      borderRadius: 6,
    },
    isMobile: {
      backgroundColor: '#0dff0c',
      borderRadius: 8,
    },
  }),
}))

export default ConversationFilterInput
