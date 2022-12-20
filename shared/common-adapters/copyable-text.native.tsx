import * as React from 'react'
import type {Props as PropsCommon} from './copyable-text'
import {useTimeout} from './use-timers'
import Text from './text'
import Box from './box'
import {NativeClipboard, NativeTouchableHighlight} from './native-wrappers.native'
import {globalStyles, globalColors, globalMargins} from '../styles'

export type Props = {
  textStyle: Object
} & PropsCommon

const CopyableText = (props: Props) => {
  const [hasCopied, setHasCopied] = React.useState(false)
  const setHasCopiedFalseLater = useTimeout(() => setHasCopied(false), 5000)
  const handleCopy = () => {
    NativeClipboard.setString(props.value)
    setHasCopied(true)
    setHasCopiedFalseLater()
  }
  return (
    <NativeTouchableHighlight
      activeOpacity={0.6}
      underlayColor={globalColors.white}
      onPress={() => handleCopy()}
      style={props.style}
    >
      <Box style={styleBase}>
        <Text style={{...styleText, ...props.textStyle}} type="BodySmall">
          {props.value}
        </Text>
        <Box style={styleCopyToastContainer}>
          <Box style={styleCopyToast}>
            <Text style={styleCopyToastText} type="Body">
              {hasCopied ? 'Copied!' : 'Tap to copy'}
            </Text>
          </Box>
        </Box>
      </Box>
    </NativeTouchableHighlight>
  )
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

export default CopyableText
