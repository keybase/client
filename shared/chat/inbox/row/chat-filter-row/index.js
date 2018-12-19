// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

let KeyHandler: any = c => c
if (!Styles.isMobile) {
  KeyHandler = require('../../../../util/key-handler.desktop').default
}

type Props = {
  isLoading: boolean,
  filter: string,
  filterFocusCount: number,
  onNewChat: () => void,
  onSetFilter: (filter: string) => void,
  onSelectDown: () => void,
  onSelectUp: () => void,
  onEnsureSelection: () => void,
}

type State = {
  isEditing: boolean,
}

class ChatFilterRow extends React.PureComponent<Props, State> {
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
  }

  _stopEditing = () => {
    this.setState({isEditing: false})
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
      children = [
        <Kb.Icon
          key="0"
          type="iconfont-search"
          style={{
            marginRight: Styles.globalMargins.tiny,
          }}
          color={Styles.globalColors.black_20}
        />,
        <Kb.Input
          hideUnderline={true}
          key="1"
          small={true}
          value={this.props.filter}
          hintText="Jump to..."
          onChangeText={this.props.onSetFilter}
          onFocus={this._startEditing}
          onBlur={this._stopEditing}
          onKeyDown={this._onKeyDown}
          onEnterKeyDown={this._onEnterKeyDown}
          ref={this._setRef}
          style={{marginRight: Styles.globalMargins.tiny}}
        />,
      ]
    } else {
      children = (
        <Kb.ClickableBox style={styles.filterContainer} onClick={this._startEditing}>
          <Kb.Icon
            type="iconfont-search"
            style={{
              marginLeft: Styles.globalMargins.tiny,
            }}
            color={Styles.globalColors.black_20}
            fontSize={16}
          />
          <Kb.Text
            type="Body"
            style={{color: Styles.globalColors.black_40, marginLeft: Styles.globalMargins.tiny}}
          >
            Jump to chat
          </Kb.Text>
        </Kb.ClickableBox>
      )
    }
    return (
      <Kb.Box style={styles.container}>
        {children}
        <Kb.Icon
          type="iconfont-compose"
          style={propsIconPlatform.style}
          color={propsIconPlatform.color}
          fontSize={propsIconPlatform.fontSize}
          onClick={this.props.onNewChat}
        />
        {this.props.isLoading && (
          <Kb.Box style={styles.loadingContainer}>
            <Kb.LoadingLine />
          </Kb.Box>
        )}
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Styles.isMobile ? Styles.globalColors.fastBlank : Styles.globalColors.blueGrey,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    position: 'relative',
  },
  filterContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: Styles.globalColors.black_10,
      borderRadius: Styles.borderRadius,
      flexGrow: 1,
      height: 24,
      justifyContent: 'center',
      marginRight: Styles.globalMargins.small,
    },
    isElectron: Styles.desktopStyles.editable,
    isMobile: {
      height: 32,
      marginRight: Styles.globalMargins.small,
    },
  }),
  loadingContainer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
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

export default (Styles.isMobile ? ChatFilterRow : KeyHandler<any>(ChatFilterRow))
