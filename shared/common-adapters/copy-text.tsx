import * as React from 'react'
import {Box2Measure} from './box'
import Icon from './icon'
import Button, {type Props as ButtonProps} from './button'
import Text, {type TextMeasureRef, type LineClampType, type TextType} from './text'
import Toast from './toast'
import {useTimeout} from './use-timers'
import * as Styles from '@/styles'
import logger from '@/logger'
import type {MeasureRef} from './measure-ref'
import {useConfigState} from '@/stores/config'

const Kb = {
  Box2Measure,
  Button,
  Icon,
  Text,
  Toast,
}

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
  const [lastShowingToast, setLastShowingToast] = React.useState(showingToast)

  if (lastShowingToast !== showingToast) {
    setLastShowingToast(showingToast)
    showingToast && setShowingToastFalseLater()
  }

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

  const popupAnchor = React.useRef<MeasureRef | null>(null)
  const textRef = React.useRef<TextMeasureRef | null>(null)
  const copyToClipboard = useConfigState(s => s.dispatch.defer.copyToClipboard)
  const showShareActionSheet = useConfigState(s => s.dispatch.defer.showShareActionSheet)
  const copy = React.useCallback(() => {
    if (!text) {
      if (!loadText) {
        logger.warn('no text to copy and no loadText method provided')
        return
      }
      setRequestedCopy(true)
    } else {
      if (shareSheet) {
        showShareActionSheet?.('', text, 'text/plain')
      } else {
        setShowingToast(true)
        textRef.current?.highlightText()
        copyToClipboard(text)
      }
      onCopy?.()
      if (hideOnCopy) {
        setRevealed(false)
      }
    }
  }, [showShareActionSheet, copyToClipboard, text, loadText, shareSheet, onCopy, hideOnCopy])

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
    props.onReveal?.()
    setRevealed(true)
  }

  const isRevealed = !props.withReveal || revealed
  const lineClamp = props.multiline
    ? typeof props.multiline === 'number'
      ? props.multiline
      : undefined
    : isRevealed
      ? 1
      : undefined

  return (
    <Kb.Box2Measure
      ref={popupAnchor}
      direction="horizontal"
      style={Styles.collapseStyles([
        styles.container,
        props.disabled && styles.containerDisabled,
        props.containerStyle,
      ])}
    >
      <Kb.Toast position="top center" attachTo={popupAnchor} visible={showingToast}>
        {Styles.isMobile && <Kb.Icon type="iconfont-clipboard" color={Styles.globalColors.whiteOrWhite} />}
        <Kb.Text type={Styles.isMobile ? 'BodySmallSemibold' : 'BodySmall'} style={styles.toastText}>
          Copied to clipboard
        </Kb.Text>
      </Kb.Toast>
      <Kb.Text
        lineClamp={lineClamp}
        type={props.textType || 'BodySmallSemibold'}
        selectable={true}
        center={true}
        style={Styles.collapseStyles([styles.text, props.disabled && styles.textDisabled])}
        allowHighlightText={true}
        textRef={textRef}
      >
        {isRevealed && (props.text || props.placeholderText)
          ? props.text || props.placeholderText
          : '••••••••••••'}
      </Kb.Text>
      {!isRevealed && (
        <Kb.Text type="BodySmallPrimaryLink" style={styles.reveal} onClick={reveal}>
          Reveal
        </Kb.Text>
      )}
      {!props.disabled && (
        <Kb.Button
          type={props.buttonType || 'Default'}
          style={styles.button}
          onClick={copy}
          labelContainerStyle={styles.buttonLabelContainer}
        >
          <Kb.Icon
            type={shareSheet ? 'iconfont-share' : 'iconfont-clipboard'}
            color={Styles.globalColors.whiteOrWhite}
          />
        </Kb.Button>
      )}
    </Kb.Box2Measure>
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
    }) as const
)

export default CopyText
