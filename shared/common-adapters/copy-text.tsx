import * as React from 'react'
import {Box2} from './box'
import Icon from './icon'
import Button, {type ButtonProps} from './button'
import Text from './text'
import type {LineClampType, TextType} from './text.shared'
import Toast from './toast'
import * as Styles from '@/styles'
import logger from '@/logger'
import type {MeasureRef} from './measure-ref'
import {copyToClipboard, showShareActionSheet} from '@/util/storeless-actions'

const Kb = {
  Box2,
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
  loadText?: (onLoaded?: (text: string) => void) => void
}

const CopyText = (props: Props) => {
  const {withReveal, text, loadText, onCopy, hideOnCopy} = props
  const [revealed, setRevealed] = React.useState(!props.withReveal)
  const [showingToast, setShowingToast] = React.useState(false)
  const shareSheet = props.shareSheet && isMobile
  const copyRequestIDRef = React.useRef(0)
  const copyOnLoadedRequestIDRef = React.useRef(0)
  const popupAnchor = React.useRef<MeasureRef | null>(null)

  const doCopy = (t: string) => {
    if (shareSheet) {
      showShareActionSheet('', t, 'text/plain')
    } else {
      setShowingToast(true)
      copyToClipboard(t)
    }
    onCopy?.()
    if (hideOnCopy) {
      setRevealed(false)
    }
  }
  const doCopyLoadedText = React.useEffectEvent((loadedText: string) => {
    doCopy(loadedText)
  })

  React.useEffect(() => {
    return () => {
      copyRequestIDRef.current += 1
      copyOnLoadedRequestIDRef.current = 0
    }
  }, [])

  React.useEffect(() => {
    if (!showingToast) {
      return undefined
    }
    const id = setTimeout(() => {
      setShowingToast(false)
    }, 1500)
    return () => {
      clearTimeout(id)
    }
  }, [showingToast])

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

  React.useEffect(() => {
    const requestID = copyOnLoadedRequestIDRef.current
    if (!requestID || !text || copyRequestIDRef.current !== requestID) {
      return
    }
    copyRequestIDRef.current = requestID + 1
    copyOnLoadedRequestIDRef.current = 0
    doCopyLoadedText(text)
  }, [text])

  const copy = () => {
    if (!text) {
      if (!loadText) {
        logger.warn('no text to copy and no loadText method provided')
        return
      }
      const requestID = copyRequestIDRef.current + 1
      copyRequestIDRef.current = requestID
      copyOnLoadedRequestIDRef.current = requestID
      loadText(loadedText => {
        if (
          copyRequestIDRef.current === requestID &&
          copyOnLoadedRequestIDRef.current === requestID &&
          loadedText
        ) {
          copyRequestIDRef.current = requestID + 1
          copyOnLoadedRequestIDRef.current = 0
          doCopy(loadedText)
        }
      })
    } else {
      doCopy(text)
    }
  }

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
    <Kb.Box2
      ref={popupAnchor}
      direction="horizontal"
      alignItems="center"
      fullWidth={true}
      relative={true}
      style={Styles.collapseStyles([
        styles.container,
        props.disabled && styles.containerDisabled,
        props.containerStyle,
      ])}
    >
      <Kb.Toast position="top center" attachTo={popupAnchor} visible={showingToast}>
        {isMobile && <Kb.Icon type="iconfont-clipboard" color={Styles.globalColors.whiteOrWhite} />}
        <Kb.Text type={isMobile ? 'BodySmallSemibold' : 'BodySmall'} style={styles.toastText}>
          Copied to clipboard
        </Kb.Text>
      </Kb.Toast>
      <Kb.Text
        lineClamp={lineClamp}
        type={props.textType || 'BodySmallSemibold'}
        selectable={true}
        center={true}
        style={Styles.collapseStyles([styles.text, props.disabled && styles.textDisabled])}
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
        <Kb.Button type={props.buttonType || 'Default'} style={styles.button} onClick={copy}>
          <Kb.Icon
            type={shareSheet ? 'iconfont-share' : 'iconfont-clipboard'}
            color={Styles.globalColors.whiteOrWhite}
          />
        </Kb.Button>
      )}
    </Kb.Box2>
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
          borderBottomRightRadius: Styles.borderRadius,
          borderTopLeftRadius: 0,
          borderTopRightRadius: Styles.borderRadius,
          height: undefined,
          marginLeft: 'auto',
          minWidth: undefined,
          ...Styles.paddingH(Styles.globalMargins.xsmall),
          width: undefined,
        },
        isElectron: {
          display: 'flex',
          minHeight: 32,
          ...Styles.paddingV(Styles.globalMargins.xtiny),
        },
        isMobile: {
          minHeight: 40,
          ...Styles.paddingV(Styles.globalMargins.tiny),
        },
      }),
      container: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blueGrey,
          borderRadius: Styles.borderRadius,
          flexGrow: 1,
        },
        isElectron: {
          maxWidth: 460,
          overflow: 'hidden',
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
          ...Styles.marginH(Styles.globalMargins.tiny),
          ...Styles.marginV(Styles.globalMargins.xtiny),
          color: Styles.globalColors.blueDark,
          flexShrink: 1,
          minWidth: 0,
          textAlign: 'left',
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
          ...Styles.paddingH(10),
          paddingTop: 5,
        },
      }),
    }) as const
)

export default CopyText
