import * as React from 'react'
import type {Props as PropsCommon} from './copyable-text'
import {useTimeout} from './use-timers'
import Text from './text'
import {Box2} from './box'
import {TouchableHighlight} from 'react-native'
import * as Styles from '@/styles'
import * as Clipboard from 'expo-clipboard'

export type Props = {
  textStyle: object
} & PropsCommon

const CopyableText = (props: Props) => {
  const [hasCopied, setHasCopied] = React.useState(false)
  const setHasCopiedFalseLater = useTimeout(() => setHasCopied(false), 5000)
  const handleCopy = () => {
    Clipboard.setStringAsync(props.value)
      .then(() => {})
      .catch(() => {})
    setHasCopied(true)
    setHasCopiedFalseLater()
  }
  return (
    <TouchableHighlight
      activeOpacity={0.6}
      underlayColor={Styles.globalColors.white}
      onPress={() => handleCopy()}
      style={props.style}
    >
      <Box2 direction="vertical" alignItems="flex-start" style={styles.base}>
        <Text style={{...styleText, ...props.textStyle}} type="BodySmall">
          {props.value}
        </Text>
        <Box2 direction="vertical" alignItems="center" style={styles.copyToastContainer}>
          <Box2 direction="horizontal" alignItems="center" style={styles.copyToast}>
            <Text style={styleCopyToastText} type="Body">
              {hasCopied ? 'Copied!' : 'Tap to copy'}
            </Text>
          </Box2>
        </Box2>
      </Box2>
    </TouchableHighlight>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      base: {
        backgroundColor: Styles.globalColors.greyLight,
        borderColor: Styles.globalColors.black_10,
        borderRadius: 3,
        borderWidth: 1,
        // Guarantee that the first line of text is shown above the 'Tap to Copy' toast
        minHeight:
          Styles.globalMargins.medium + Styles.globalMargins.tiny + 2 * Styles.globalMargins.small + 24,
        padding: 10,
        position: 'relative',
      },
      copyToast: {
        backgroundColor: Styles.globalColors.black_50,
        borderRadius: Styles.globalMargins.large,
        height: Styles.globalMargins.medium + Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.medium,
      },
      copyToastContainer: {
        bottom: Styles.globalMargins.small,
        left: 0,
        position: 'absolute',
        right: 0,
      },
    }) as const
)

const styleText = {
  ...Styles.globalStyles.fontTerminal,
  color: Styles.globalColors.black,
}

const styleCopyToastText = {
  color: Styles.globalColors.white,
}

export default CopyableText
