// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Platforms from '../constants/platform'
import flags from '../util/feature-flags'

export type Props = {|
  filter: string,
  isLoading: boolean,
  isSearching: boolean,
  onBack: () => void,
  noShortcut: ?boolean,
  onEnsureSelection: () => void,
  onNewChat?: () => void,
  onSelectDown: () => void,
  onSelectUp: () => void,
  onSetFilter: (filter: string) => void,
  onStartSearch: () => void,
  onStopSearch: () => void,
  style?: Styles.StylesCrossPlatform,
|}

class ConversationFilterInput extends React.PureComponent<Props> {
  _input: any

  _onKeyDown = (e: SyntheticKeyboardEvent<>, isComposingIME: boolean) => {
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

  _onEnterKeyDown = (e: SyntheticKeyboardEvent<>) => {
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
            flags.useNewRouter && !Styles.isMobile && styles.whiteBg,
            this.props.style,
          ])}
        >
          <Kb.Icon
            type="iconfont-search"
            style={styles.icon}
            color={Styles.globalColors.black_50}
            fontSize={Styles.isMobile ? 20 : 16}
          />
          <Kb.Input
            autoFocus={Styles.isMobile}
            hideUnderline={true}
            small={true}
            value={this.props.filter}
            hintText="Search..."
            onChangeText={this.props.onSetFilter}
            onKeyDown={this._onKeyDown}
            onEnterKeyDown={this._onEnterKeyDown}
            ref={this._setRef}
            style={styles.input}
          />
          <Kb.Icon
            type="iconfont-remove"
            fontSize={16}
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
            flags.useNewRouter && Styles.isMobile && styles.containerWithBackButton,
            flags.useNewRouter && !Styles.isMobile && styles.whiteBg,
            this.props.style,
          ])}
          gapStart={true}
          gapEnd={true}
          fullWidth={true}
        >
          <Kb.Box2 alignItems="center" direction="horizontal" style={styles.flexOne}>
            {flags.useNewRouter && Styles.isMobile && (
              <Kb.BackButton onClick={this.props.onBack} style={styles.backButton} />
            )}
            <Kb.ClickableBox style={styles.filterContainer} onClick={this.props.onStartSearch}>
              <Kb.Icon
                type="iconfont-search"
                style={styles.icon}
                color={Styles.globalColors.black_50}
                fontSize={Styles.isMobile ? 20 : 16}
              />
              <Kb.Text type="BodySemibold" style={styles.text}>
                Search...
              </Kb.Text>
              {!Styles.isMobile && !this.props.noShortcut && (
                <Kb.Text type="BodySemibold" style={styles.textFaint}>
                  ({Platforms.shortcutSymbol}K)
                </Kb.Text>
              )}
            </Kb.ClickableBox>
          </Kb.Box2>
          {!!this.props.onNewChat && (
            <Kb.WithTooltip position="bottom center" text={`New chat (${Platforms.shortcutSymbol}N)`}>
              <Kb.Button small={true} onClick={this.props.onNewChat}>
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

const styles = Styles.styleSheetCreate({
  backButton: {
    ...Styles.padding(Styles.globalMargins.tiny, 0),
  },
  containerFiltering: Styles.platformStyles({
    common: {
      height: 48,
      position: 'relative',
    },
    isElectron: {
      ...Styles.padding(0, Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small, 0, Styles.globalMargins.xsmall),
      backgroundColor: Styles.globalColors.fastBlank,
    },
  }),
  containerNotFiltering: Styles.platformStyles({
    common: {
      height: flags.useNewRouter ? undefined : 48,
      position: 'relative',
    },
    isElectron: !flags.useNewRouter
      ? undefined
      : {
          ...Styles.padding(0, Styles.globalMargins.xtiny),
          backgroundColor: Styles.globalColors.blueGrey,
        },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.tiny),
      backgroundColor: Styles.globalColors.fastBlank,
    },
  }),
  containerWithBackButton: {
    ...Styles.padding(0, Styles.globalMargins.tiny, 0, 0), // back button adds the left space
  },
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
      paddingLeft: 16,
    },
  }),
  flexOne: {flex: 1},
  icon: {
    position: 'relative',
    top: 1,
  },
  input: {
    color: Styles.globalColors.black_50,
    position: 'relative',
    top: 1,
  },
  loadingContainer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  newIcon: {
    position: 'relative',
    top: 1,
  },
  text: {
    color: Styles.globalColors.black_50,
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
    position: 'relative',
    top: 1,
  },
  textFaint: {
    color: Styles.globalColors.black_35,
    position: 'relative',
    top: 1,
  },
  whiteBg: {
    backgroundColor: Styles.globalColors.white,
  },
})

export default ConversationFilterInput
