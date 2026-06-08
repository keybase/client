import * as React from 'react'
import {useTimeout} from './use-timers'
import Text from './text'
import {Box2} from './box'
import {TouchableHighlight} from 'react-native'
import {setStringAsync} from 'expo-clipboard'
import * as Styles from '@/styles'

export type Props = {
  value: string
  style?: object
  textStyle?: object
}

const CopyableText = (props: Props) => {
  const [hasCopied, setHasCopied] = React.useState(false)
  const setHasCopiedFalseLater = useTimeout(() => setHasCopied(false), 5000)

  if (!isMobile) {
    return (
      <textarea
        style={Styles.castStyleDesktop(Styles.collapseStyles([styles.base, props.style]))}
        readOnly={true}
        value={props.value}
        onClick={e => {
          const target = e.target as unknown as {focus: () => void; select: () => void}
          target.focus()
          target.select()
        }}
      />
    )
  }

  const handleCopy = () => {
    setStringAsync(props.value)
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
      <Box2 direction="vertical" fullWidth={true} alignItems="flex-start" relative={true} style={styles.base}>
        <Text style={Styles.collapseStyles([styles.text, props.textStyle])} type="BodySmall">
          {props.value}
        </Text>
        <Box2 direction="vertical" alignItems="center" style={styles.copyToastContainer}>
          <Box2 direction="horizontal" alignItems="center" style={styles.copyToast}>
            <Text style={styles.copyToastText} type="Body">
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
      base: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.fontTerminal,
          alignItems: 'flex-start',
          backgroundColor: Styles.globalColors.greyLight,
          ...Styles.globalStyles.rounded,
          color: Styles.globalColors.black,
          fontSize: 13,
          padding: 10,
          textAlign: 'left',
        },
        isElectron: {
          border: `solid 1px ${Styles.globalColors.black_10}`,
          justifyContent: 'stretch',
          lineHeight: '17px',
          overflowX: 'hidden',
          overflowY: 'auto',
          resize: 'none',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
        },
        isMobile: {
          borderColor: Styles.globalColors.black_10,
          borderWidth: 1,
          // Guarantee that the first line of text is shown above the 'Tap to Copy' toast
          minHeight:
            Styles.globalMargins.medium + Styles.globalMargins.tiny + 2 * Styles.globalMargins.small + 24,
        },
      }),
      copyToast: {
        ...Styles.paddingH(Styles.globalMargins.medium),
        backgroundColor: Styles.globalColors.black_50,
        borderRadius: Styles.globalMargins.large,
        height: Styles.globalMargins.medium + Styles.globalMargins.tiny,
      },
      copyToastContainer: {
        bottom: Styles.globalMargins.small,
        left: 0,
        position: 'absolute',
        right: 0,
      },
      copyToastText: {
        color: Styles.globalColors.white,
      },
      text: {
        ...Styles.globalStyles.fontTerminal,
        color: Styles.globalColors.black,
      },
    }) as const
)

export default CopyableText
