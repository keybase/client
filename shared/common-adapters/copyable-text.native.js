// @flow
import HOCTimers from './hoc-timers'
import React, {Component} from 'react'
import type {Props as PropsCommon} from './copyable-text'
import type {TimerProps} from './hoc-timers'
import Text from './text'
import Box from './box'
import {Clipboard, TouchableHighlight} from 'react-native'
import {globalStyles, globalColors, globalMargins} from '../styles'

export type Props = PropsCommon & {
  textStyle: Object,
}

type State = {
  hasCopied: boolean,
}

class CopyableText extends Component<void, Props & TimerProps, State> {
  state: State
  lastCopyTimeoutId: ?number

  constructor(props: Props) {
    super(props)
    this.state = {
      hasCopied: false,
    }
  }

  _handleCopy() {
    Clipboard.setString(this.props.value)
    this.setState({hasCopied: true})
    this.props.clearTimeout(this.lastCopyTimeoutId)
    this.lastCopyTimeoutId = this.props.setTimeout(() => {
      this.setState({hasCopied: false})
    }, 5000)
  }

  render() {
    const {value, style, textStyle} = this.props
    return (
      <TouchableHighlight
        activeOpacity={0.6}
        underlayColor={globalColors.white}
        onPress={() => this._handleCopy()}
        style={style}
      >
        <Box style={styleBase}>
          <Text style={{...styleText, ...textStyle}} type="BodySmall">
            {value}
          </Text>
          <Box style={styleCopyToastContainer}>
            <Box style={styleCopyToast}>
              <Text style={styleCopyToastText} type="Body">
                {this.state.hasCopied ? 'Copied!' : 'Tap to copy'}
              </Text>
            </Box>
          </Box>
        </Box>
      </TouchableHighlight>
    )
  }
}

const styleBase = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  alignItems: 'flex-start',
  backgroundColor: globalColors.lightGrey,
  padding: 10,
  borderWidth: 1,
  borderColor: globalColors.black_10,
  borderRadius: 3,
  minHeight: globalMargins.medium +
    globalMargins.tiny +
    2 * globalMargins.small +
    24, // Guarantee that the first line of text is shown above the 'Tap to Copy' toast
}

const styleText = {
  ...globalStyles.fontTerminal,
  color: globalColors.black_75,
}

const styleCopyToastContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  position: 'absolute',
  bottom: globalMargins.small,
  left: 0,
  right: 0,
}

const styleCopyToast = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.black_40,
  borderRadius: globalMargins.large,
  height: globalMargins.medium + globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const styleCopyToastText = {
  color: globalColors.white,
}

export default HOCTimers(CopyableText)
