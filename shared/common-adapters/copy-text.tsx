import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import {Box2} from './box'
import Icon from './icon'
import Button, {Props as ButtonProps} from './button'
import Text from './text'
import Toast from './toast'
import {useTimeout} from './use-timers'
import * as Styles from '../styles'
import * as Container from '../util/container'

type Props = {
  buttonType?: ButtonProps['type']
  containerStyle?: Styles.StylesCrossPlatform
  multiline?: boolean | number
  onCopy?: () => void
  hideOnCopy?: boolean
  onReveal?: () => void
  withReveal?: boolean
  text: string
}

const CopyText = (props: Props) => {
  const [revealed, setRevealed] = React.useState(!props.withReveal)
  const [showingToast, setShowingToast] = React.useState(false)

  const setShowingToastFalseLater = useTimeout(() => setShowingToast(false), 1500)
  React.useEffect(() => {
    showingToast && setShowingToastFalseLater()
  }, [showingToast, setShowingToastFalseLater])

  const attachmentRef = React.useRef<Box2>(null)
  const textRef = React.useRef<Text>(null)

  const dispatch = Container.useDispatch()
  const copyToClipboard = (text: string) => dispatch(ConfigGen.createCopyToClipboard({text}))
  const copy = () => {
    if (props.withReveal && !revealed) {
      reveal()
    }
    setShowingToast(true)
    textRef.current && textRef.current.highlightText()
    copyToClipboard(props.text)
    props.onCopy && props.onCopy()
    if (props.hideOnCopy) {
      setRevealed(false)
    }
  }
  const reveal = () => {
    props.onReveal && props.onReveal()
    setRevealed(true)
  }

  const isRevealed = !props.withReveal || revealed
  const lineClamp = props.multiline
    ? typeof props.multiline === 'number'
      ? props.multiline
      : null
    : isRevealed
    ? 1
    : null
  return (
    <Box2
      ref={attachmentRef}
      direction="horizontal"
      style={Styles.collapseStyles([styles.container, props.containerStyle])}
    >
      <Toast position="top center" attachTo={() => attachmentRef.current} visible={showingToast}>
        {Styles.isMobile && <Icon type="iconfont-clipboard" color="white" fontSize={22} />}
        <Text type={Styles.isMobile ? 'BodySmallSemibold' : 'BodySmall'} style={styles.toastText}>
          Copied to clipboard
        </Text>
      </Toast>
      <Text
        lineClamp={lineClamp}
        type="BodyTiny"
        selectable={true}
        center={true}
        style={styles.text}
        allowHighlightText={true}
        ref={textRef}
      >
        {isRevealed ? props.text : '••••••••••••'}
      </Text>
      {!isRevealed && (
        <Text type="BodySmallPrimaryLink" style={styles.reveal} onClick={reveal}>
          Reveal
        </Text>
      )}
      <Button
        type={props.buttonType || 'Default'}
        style={styles.button}
        onClick={copy}
        labelContainerStyle={styles.buttonLabelContainer}
      >
        <Icon type="iconfont-clipboard" color={Styles.globalColors.white} sizeType="Small" />
      </Button>
    </Box2>
  )
}

// border radii aren't literally so big, just sets it to maximum
const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: Styles.platformStyles({
        common: {
          alignSelf: 'stretch',
          height: undefined,
          marginLeft: 'auto',
          minWidth: undefined,
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
        },
        isElectron: {
          display: 'flex',
          paddingBottom: Styles.globalMargins.xtiny,
          paddingTop: Styles.globalMargins.xtiny,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
      buttonLabelContainer: {
        height: undefined,
      },
      container: Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Styles.globalColors.blueGrey,
          borderRadius: Styles.borderRadius,
          flexGrow: 1,
          position: 'relative',
          width: '100%',
        },
        isElectron: {
          maxWidth: 460,
          overflow: 'hidden',
        },
        isMobile: {
          // minHeight: 40,
        },
      }),
      reveal: {
        marginLeft: Styles.globalMargins.tiny,
      },
      text: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.fontTerminal,
          color: Styles.globalColors.blueDark,
          flexShrink: 1,
          marginBottom: Styles.globalMargins.xtiny,
          marginLeft: Styles.globalMargins.tiny,
          marginRight: Styles.globalMargins.tiny,
          marginTop: Styles.globalMargins.xtiny,
          minWidth: 0,
          textAlign: 'left',
        },
        isAndroid: {
          // position: 'relative',
          // top: 3,
        },
        isElectron: {
          userSelect: 'all',
          wordBreak: 'break-all',
        },
        isMobile: {
          minHeight: 13,
        },
      }),
      toastText: Styles.platformStyles({
        common: {
          color: Styles.globalColors.white,
          textAlign: 'center',
        },
        isMobile: {
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 5,
        },
      }),
    } as const)
)

export default CopyText
