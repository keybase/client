import * as React from 'react'
import {Props as PropsCommon} from './copyable-text'
import HOCTimers, {PropsWithTimer} from './hoc-timers'
import Text from './text'
import Box from './box'
import {NativeClipboard, NativeTouchableHighlight} from './native-wrappers.native'
import {globalStyles, globalColors, globalMargins} from '../styles'

export type Props = PropsWithTimer<
  {
    textStyle: Object
  } & PropsCommon
>

type State = {
  hasCopied: boolean
}

class CopyableText extends React.Component<Props, State> {
  state = {hasCopied: false}
  lastCopyTimeoutId?: NodeJS.Timeout

  _handleCopy() {
    NativeClipboard.setString(this.props.value)
    this.setState({hasCopied: true})
    this.lastCopyTimeoutId && this.props.clearTimeout(this.lastCopyTimeoutId)
    this.lastCopyTimeoutId =
      this.props.setTimeout(() => {
        this.setState({hasCopied: false})
      }, 5000) || undefined
  }

  render() {
    const {value, style, textStyle} = this.props
    return (
      <NativeTouchableHighlight
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
      </NativeTouchableHighlight>
    )
  }
}

const styleBase = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  backgroundColor: globalColors.greyLight,
  borderColor: globalColors.black_10,
  borderRadius: 3,
  borderWidth: 1,
  // Guarantee that the first line of text is shown above the 'Tap to Copy' toast
  minHeight: globalMargins.medium + globalMargins.tiny + 2 * globalMargins.small + 24,
  padding: 10,
  position: 'relative',
}

const styleText = {
  ...globalStyles.fontTerminal,
  color: globalColors.black,
}

const styleCopyToastContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  bottom: globalMargins.small,
  left: 0,
  position: 'absolute',
  right: 0,
}

const styleCopyToast = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.black_50,
  borderRadius: globalMargins.large,
  height: globalMargins.medium + globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
}

const styleCopyToastText = {
  color: globalColors.white,
}

export default HOCTimers(CopyableText)
