// @flow
import React, {Component} from 'react'
import {Icon, Box, ClickableBox, LoadingLine, Input, Text} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {branch} from 'recompose'

let KeyHandler
if (!isMobile) {
  KeyHandler = require('../../../util/key-handler.desktop').default
}

type Props = {
  isLoading: boolean,
  filter: string,
  filterFocusCount: number,
  onNewChat: () => void,
  onSetFilter: (filter: string) => void,
  onSelectDown: () => void,
  onSelectUp: () => void,
}

type State = {
  isEditing: boolean,
}

class _ChatFilterRow extends Component<Props, State> {
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
      this.props.onSelectDown()
    } else if (e.key === 'ArrowUp') {
      this.props.onSelectUp()
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.filterFocusCount !== nextProps.filterFocusCount) {
      this._startEditing()
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.isEditing !== prevState.isEditing && this.state.isEditing) {
      this._input && this._input.focus()
    }
  }

  _setRef = r => (this._input = r)

  render() {
    let children
    if (this.state.isEditing || this.props.filter) {
      children = [
        <Icon
          key="0"
          type="iconfont-search"
          style={{
            color: globalColors.black_20,
            fontSize: 12,
            marginLeft: globalMargins.tiny,
            marginRight: globalMargins.tiny,
          }}
        />,
        <Input
          hideUnderline={true}
          key="1"
          small={true}
          value={this.props.filter}
          hintText="Jump to..."
          onChangeText={this.props.onSetFilter}
          onFocus={this._startEditing}
          onBlur={this._stopEditing}
          onKeyDown={this._onKeyDown}
          ref={this._setRef}
        />,
      ]
    } else {
      children = (
        <ClickableBox style={styleFilterContainer} onClick={this._startEditing}>
          <Icon
            type="iconfont-search"
            style={{
              color: globalColors.black_20,
              fontSize: 12,
              marginLeft: globalMargins.tiny,
            }}
          />
          <Text type="Body" style={{color: globalColors.black_20, marginLeft: globalMargins.tiny}}>
            Jump to chat
          </Text>
        </ClickableBox>
      )
    }
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
          position: 'relative',
        }}
      >
        {children}
        <Icon
          type="iconfont-compose"
          style={{color: globalColors.blue, marginLeft: globalMargins.tiny, marginRight: globalMargins.tiny}}
          onClick={this.props.onNewChat}
        />
        {this.props.isLoading &&
          <Box style={{bottom: 0, left: 0, position: 'absolute', right: 0}}>
            <LoadingLine />
          </Box>}
      </Box>
    )
  }
}

const styleFilterContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.lightGrey,
  borderRadius: 19,
  flexGrow: 1,
  height: globalMargins.medium,
  justifyContent: 'center',
  marginLeft: globalMargins.tiny,
  width: 160,
}

const ChatFilterRow = branch(() => !isMobile, KeyHandler)(_ChatFilterRow)

export default ChatFilterRow
