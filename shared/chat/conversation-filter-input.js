// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Platforms from '../constants/platform'

export type Props = {|
  filter: string,
  filterFocusCount: number,
  isLoading: boolean,
  onBlur: () => void,
  onEnsureSelection: () => void,
  onFocus: () => void,
  onNewChat?: () => void,
  onSelectDown: () => void,
  onSelectUp: () => void,
  onSetFilter: (filter: string) => void,
  style?: Styles.StylesCrossPlatform,
|}

type State = {
  isEditing: boolean,
}

class ConversationFilterInput extends React.PureComponent<Props, State> {
  state: State
  _input: any

  constructor(props: Props) {
    super(props)
    this.state = {
      isEditing: false,
    }
  }

  _startEditing = () => {
    this.setState({isEditing: true})
    this.props.onFocus()
  }

  _stopEditing = () => {
    this.setState({isEditing: false})
    this.props.onBlur()
  }

  _onKeyDown = (e: SyntheticKeyboardEvent<>, isComposingIME: boolean) => {
    if (e.key === 'Escape' && !isComposingIME) {
      this.props.onSetFilter('')
      this._stopEditing()
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
      this.props.onSetFilter('')
      this._stopEditing()
      this._input && this._input.blur()
      this.props.onEnsureSelection()
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.isEditing !== prevState.isEditing && this.state.isEditing) {
      this._input && this._input.focus()
    }
    if (this.props.filterFocusCount !== prevProps.filterFocusCount) {
      this._startEditing()
    }
  }

  _setRef = r => (this._input = r)

  render() {
    let children
    if (this.state.isEditing || this.props.filter) {
      children = (
        <Kb.Box style={styles.inputContainer}>
          <Kb.Icon
            type="iconfont-search"
            style={styles.icon}
            color={Styles.globalColors.black_50}
            fontSize={Styles.isMobile ? 20 : 16}
          />
          <Kb.Input
            hideUnderline={true}
            small={true}
            value={this.props.filter}
            hintText="Jump to..."
            onChangeText={this.props.onSetFilter}
            onFocus={this._startEditing}
            onBlur={this._stopEditing}
            onKeyDown={this._onKeyDown}
            onEnterKeyDown={this._onEnterKeyDown}
            ref={this._setRef}
            style={styles.text}
          />
        </Kb.Box>
      )
    } else {
      children = (
        <Kb.ClickableBox style={styles.filterContainer} onClick={this._startEditing}>
          <Kb.Icon
            type="iconfont-search"
            style={styles.icon}
            color={Styles.globalColors.black_50}
            fontSize={Styles.isMobile ? 20 : 16}
          />
          <Kb.Text type="BodySemibold" style={styles.text}>
            Jump to chat
          </Kb.Text>
          {!Styles.isMobile && (
            <Kb.Text type="BodySemibold" style={styles.textFaint}>
              ({Platforms.shortcutSymbol}K)
            </Kb.Text>
          )}
        </Kb.ClickableBox>
      )
    }
    return Styles.isMobile ? (
      <>
        <Kb.HeaderHocHeader
          borderless={true}
          rightActions={[
            {
              icon: 'iconfont-compose',
              iconColor: Styles.globalColors.blue,
              label: 'New chat',
              onPress: this.props.onNewChat,
            },
          ]}
          titleComponent={children}
        />
        {this.props.isLoading && (
          <Kb.Box style={styles.loadingContainer}>
            <Kb.LoadingLine />
          </Kb.Box>
        )}
      </>
    ) : (
      <Kb.Box2
        direction="horizontal"
        centerChildren={true}
        gap="small"
        style={Styles.collapseStyles([styles.container, this.props.style])}
        gapStart={true}
        gapEnd={true}
        fullWidth={true}
      >
        {children}
        {!!this.props.onNewChat && (
          <Kb.WithTooltip position="bottom center" text={`${Platforms.shortcutSymbol}N`}>
            <Kb.Icon
              type="iconfont-compose"
              style={propsIconPlatform.style}
              color={propsIconPlatform.color}
              fontSize={propsIconPlatform.fontSize}
              onClick={this.props.onNewChat}
            />
          </Kb.WithTooltip>
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      minHeight: 48,
      position: 'relative',
    },
    isElectron: {
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
      justifyContent: 'center',
    },
    isElectron: {
      ...Styles.desktopStyles.editable,
      flexGrow: 1,
      height: 24,
    },
    isMobile: {
      height: 32,
      width: '100%',
    },
  }),
  icon: Styles.platformStyles({
    common: {
      position: 'relative',
    },
    isElectron: {
      top: 2,
    },
    isMobile: {
      top: 1,
    },
  }),
  inputContainer: {
    ...Styles.globalStyles.flexBoxRow,
  },
  loadingContainer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  text: {
    color: Styles.globalColors.black_50,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },
  textFaint: {
    color: Styles.globalColors.black_35,
  },
})

const propsIconCompose = {
  color: Styles.globalColors.blue,
  fontSize: 16,
  style: {},
}

const propsIconComposeMobile = {
  ...propsIconCompose,
  fontSize: 20,
  style: {
    padding: Styles.globalMargins.xtiny,
  },
}

const propsIconPlatform = Styles.isMobile ? propsIconComposeMobile : propsIconCompose

export default ConversationFilterInput
