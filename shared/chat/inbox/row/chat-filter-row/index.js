// @flow
import * as React from 'react'
import {Icon, Box, ClickableBox, LoadingLine, Input, Text} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../../../styles'

let KeyHandler = c => c
if (!isMobile) {
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
    if (!isMobile) {
      e.preventDefault()
      e.stopPropagation()
      this.props.onSetFilter('')
      this._stopEditing()
      this._input && this._input.blur()
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
        <Icon
          key="0"
          type="iconfont-search"
          style={{
            marginRight: globalMargins.tiny,
          }}
          color={globalColors.black_20}
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
          onEnterKeyDown={this._onEnterKeyDown}
          ref={this._setRef}
          style={{marginRight: globalMargins.tiny}}
        />,
      ]
    } else {
      children = (
        <ClickableBox
          style={isMobile ? styleFilterContainerMobile : styleFilterContainer}
          onClick={this._startEditing}
        >
          <Icon
            type="iconfont-search"
            style={{
              marginLeft: globalMargins.tiny,
            }}
            color={globalColors.black_20}
            fontSize={16}
          />
          <Text type="Body" style={{color: globalColors.black_40, marginLeft: globalMargins.tiny}}>
            Jump to chat
          </Text>
        </ClickableBox>
      )
    }
    return (
      <Box style={styleContainer}>
        {children}
        <Icon
          type="iconfont-compose"
          style={propsIconPlatform.style}
          color={propsIconPlatform.color}
          fontSize={propsIconPlatform.fontSize}
          onClick={this.props.onNewChat}
        />
        {this.props.isLoading && (
          <Box style={loadingContainer}>
            <LoadingLine />
          </Box>
        )}
      </Box>
    )
  }
}

const loadingContainer = {
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: isMobile ? globalColors.fastBlank : globalColors.blue5,
  justifyContent: 'space-between',
  minHeight: 48,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  position: 'relative',
}

const styleFilterContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.black_05,
  borderRadius: 19,
  flexGrow: 1,
  height: 24,
  justifyContent: 'center',
  marginRight: globalMargins.small,
}

const styleFilterContainerMobile = {
  ...styleFilterContainer,
  height: 32,
  marginRight: globalMargins.small,
}

const propsIconCompose = {
  color: globalColors.blue,
  fontSize: 16,
  style: {},
}

const propsIconComposeMobile = {
  ...propsIconCompose,
  fontSize: 20,
  style: {
    padding: globalMargins.xtiny,
  },
}

const propsIconPlatform = isMobile ? propsIconComposeMobile : propsIconCompose

export default (isMobile ? ChatFilterRow : KeyHandler(ChatFilterRow))
