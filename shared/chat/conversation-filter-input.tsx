import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Platforms from '../constants/platform'

export type Props = {
  filter: string
  isLoading: boolean
  isSearching: boolean
  showNewTag: boolean
  onBack: () => void
  noShortcut: boolean | null
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

  _onEnterKeyDown = (e: React.BaseSyntheticEvent) => {
    if (!Styles.isMobile) {
      e.preventDefault()
      e.stopPropagation()
      this.props.onEnsureSelection()
      this._input && this._input.blur()
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (!prevProps.isSearching && this.props.isSearching) {
      this._input && this._input.focus()
    }
  }

  _setRef = r => (this._input = r)

  render() {
    let children
    if (this.props.isSearching) {
      children = (
        <Kb.Box2
          alignItems="center"
          direction="horizontal"
          fullWidth={true}
          gap={Styles.isMobile ? 'xsmall' : 'tiny'}
          style={Styles.collapseStyles([
            styles.containerFiltering,
            !Styles.isMobile && styles.whiteBg,
            this.props.style,
          ])}
        >
          <Kb.Input
            autoFocus={Styles.isMobile}
            hideUnderline={true}
            small={true}
            value={this.props.filter}
            hintText="Search your chats..."
            onChangeText={this.props.onSetFilter}
            onKeyDown={this._onKeyDown}
            onEnterKeyDown={this._onEnterKeyDown}
            ref={this._setRef}
            style={styles.input}
          />
          <Kb.Icon
            type="iconfont-remove"
            sizeType="Small"
            color={Styles.globalColors.black_50}
            onClick={this.props.onStopSearch}
            style={styles.icon}
          />
        </Kb.Box2>
      )
    } else {
      children = (
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
          <Kb.Box2 alignItems="center" direction="horizontal" style={styles.searchBox}>
            <Kb.WithTooltip
              disabled={!this.props.showNewTag}
              containerStyle={{flexGrow: 1}}
              position="top center"
              text="NEW! Search all your chats."
            >
              <Kb.ClickableBox style={styles.filterContainer} onClick={this.props.onStartSearch}>
                <Kb.Icon
                  type="iconfont-search"
                  style={styles.icon}
                  color={Styles.globalColors.black_50}
                  sizeType="Small"
                />
                <Kb.Text type="BodySemibold" style={styles.text}>
                  {Styles.isMobile ? 'Search your chats' : 'Search'}
                </Kb.Text>
                {!Styles.isMobile && !this.props.noShortcut && (
                  <Kb.Text type="BodySemibold" style={styles.textFaint}>
                    ({Platforms.shortcutSymbol}K)
                  </Kb.Text>
                )}
                {this.props.showNewTag && (
                  <Kb.Box2
                    direction="horizontal"
                    alignItems="center"
                    style={{flexGrow: 1, justifyContent: 'flex-end', paddingRight: Styles.globalMargins.tiny}}
                  >
                    <Kb.Meta backgroundColor={Styles.globalColors.blue} title="New" />
                  </Kb.Box2>
                )}
              </Kb.ClickableBox>
            </Kb.WithTooltip>
          </Kb.Box2>
          {!!this.props.onNewChat && !Styles.isMobile && (
            <Kb.WithTooltip position="top center" text={`New chat (${Platforms.shortcutSymbol}N)`}>
              <Kb.Button small={true} onClick={this.props.onNewChat} style={styles.newChatButton}>
                <Kb.Icon type="iconfont-compose" color={Styles.globalColors.white} style={styles.newIcon} />
              </Kb.Button>
            </Kb.WithTooltip>
          )}
        </Kb.Box2>
      )
    }
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
      ...Styles.padding(0, Styles.globalMargins.tiny),
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
  newChatButton: Styles.platformStyles({isElectron: Styles.desktopStyles.windowDraggingClickable}),
  newIcon: {
    position: 'relative',
    top: 1,
  },
  searchBox: Styles.platformStyles({
    common: {flex: 1},
    isElectron: Styles.desktopStyles.windowDraggingClickable,
    isMobile: {...Styles.padding(10, 0)},
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
}))

export default ConversationFilterInput
