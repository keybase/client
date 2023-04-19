import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import {Box2} from './box'
import Icon from './icon'
import Button, {type Props as ButtonProps} from './button'
import Text, {type LineClampType, type TextType} from './text'
import Toast from './toast'
import {useTimeout} from './use-timers'
import * as Styles from '../styles'
import * as Container from '../util/container'
import logger from '../logger'

type Props = {
  buttonType?: ButtonProps['type']
  containerStyle?: Styles.StylesCrossPlatform
  disabled?: boolean
  multiline?: boolean | LineClampType
  onCopy?: () => void
  hideOnCopy?: boolean
  onReveal?: () => void
  withReveal?: boolean
  text?: string
  textType?: TextType
  placeholderText?: string
  shareSheet?: boolean // (mobile only) show share sheet instead of copying
  loadText?: () => void
}

const CopyText = (props: Props) => {
  const {withReveal, text, loadText, onCopy, hideOnCopy} = props
  const [revealed, setRevealed] = React.useState(!props.withReveal)
  const [showingToast, setShowingToast] = React.useState(false)
  const [requestedCopy, setRequestedCopy] = React.useState(false)
  const shareSheet = props.shareSheet && Styles.isMobile
  const setShowingToastFalseLater = useTimeout(() => setShowingToast(false), 1500)
  React.useEffect(() => {
    showingToast && setShowingToastFalseLater()
  }, [showingToast, setShowingToastFalseLater])

  React.useEffect(() => {
    if (!withReveal && !text) {
      // only try to load text if withReveal is false
      if (!loadText) {
        logger.warn('no loadText method provided')
        return
      }
      loadText()
    }
  }, [withReveal, text, loadText])

  const attachmentRef = React.useRef<Box2>(null)
  const textRef = React.useRef<Text>(null)

  const dispatch = Container.useDispatch()

  const copy = React.useCallback(() => {
    if (!text) {
      if (!loadText) {
        logger.warn('no text to copy and no loadText method provided')
        return
      }
      setRequestedCopy(true)
    } else {
      if (shareSheet) {
        dispatch(ConfigGen.createShowShareActionSheet({message: text, mimeType: 'text/plain'}))
      } else {
        setShowingToast(true)
        textRef.current && textRef.current.highlightText()
        dispatch(ConfigGen.createCopyToClipboard({text}))
      }
      onCopy && onCopy()
      if (hideOnCopy) {
        setRevealed(false)
      }
    }
  }, [text, loadText, shareSheet, dispatch, onCopy, hideOnCopy])

  React.useEffect(() => {
    if (requestedCopy && loadText) {
      // we're requesting a copy
      if (!text) {
        // no text has been loaded
        loadText()
      } else {
        // we want to copy something + have something to copy
        copy() // props.text exists so this will not cause a recursive loop
        setRequestedCopy(false)
      }
    }
  }, [requestedCopy, text, copy, loadText])

  const reveal = () => {
    if (!props.text && props.loadText) {
      // if we don't have text to copy we should load it
      props.loadText()
    }
    props.onReveal && props.onReveal()
    setRevealed(true)
  }

  const isRevealed = !props.withReveal || revealed
  const lineClamp = props.multiline
    ? typeof props.multiline === 'number'
      ? (props.multiline as LineClampType)
      : null
    : isRevealed
    ? 1
    : null

  return (
    <Box2
      ref={attachmentRef}
      direction="horizontal"
      style={Styles.collapseStyles([
        styles.container,
        props.disabled && styles.containerDisabled,
        props.containerStyle,
      ])}
    >
      <Toast position="top center" attachTo={() => attachmentRef.current} visible={showingToast}>
        {Styles.isMobile && <Icon type="iconfont-clipboard" color={Styles.globalColors.whiteOrWhite} />}
        <Text type={Styles.isMobile ? 'BodySmallSemibold' : 'BodySmall'} style={styles.toastText}>
          Copied to clipboard
        </Text>
      </Toast>
      <Text
        lineClamp={lineClamp}
        type={props.textType || 'BodySmallSemibold'}
        selectable={true}
        center={true}
        style={Styles.collapseStyles([styles.text, props.disabled && styles.textDisabled])}
        allowHighlightText={true}
        ref={textRef}
      >
        {isRevealed && (props.text || props.placeholderText)
          ? props.text || props.placeholderText
          : '••••••••••••'}
      </Text>
      {!isRevealed && (
        <Text type="BodySmallPrimaryLink" style={styles.reveal} onClick={reveal}>
          Reveal
        </Text>
      )}
      {!props.disabled && (
        <Button
          type={props.buttonType || 'Default'}
          style={styles.button}
          onClick={copy}
          labelContainerStyle={styles.buttonLabelContainer}
        >
          <Icon
            type={shareSheet ? 'iconfont-share' : 'iconfont-clipboard'}
            color={Styles.globalColors.whiteOrWhite}
          />
        </Button>
      )}
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
          borderBottomLeftRadius: 0,
          borderTopLeftRadius: 0,
          height: undefined,
          marginLeft: 'auto',
          minWidth: undefined,
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
        },
        isElectron: {
          display: 'flex',
          minHeight: 32,
          paddingBottom: Styles.globalMargins.xtiny,
          paddingTop: Styles.globalMargins.xtiny,
        },
        isMobile: {
          minHeight: 40,
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
      containerDisabled: {
        backgroundColor: Styles.globalColors.black_10,
      },
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
      textDisabled: {
        color: Styles.globalColors.black_50,
      },
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
