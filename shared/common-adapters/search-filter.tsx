import * as React from 'react'
import Animation from './animation'
import Box, {Box2, Box2Measure} from './box'
import ClickableBox, {ClickableBox2} from './clickable-box'
import NewInput from './new-input'
import {HotKey} from './hot-key'
import PlainInput from './plain-input'
import Text, {type AllowedColors} from './text'
import ProgressIndicator from './progress-indicator'
import Icon, {type IconType} from './icon'
import * as Styles from '@/styles'
import * as Platforms from '@/constants/platform'
import type {NativeSyntheticEvent} from 'react-native'
import type {MeasureRef} from './measure-ref'

const Kb = {
  Animation,
  Box,
  Box2,
  Box2Measure,
  ClickableBox,
  ClickableBox2,
  HotKey,
  Icon,
  NewInput,
  PlainInput,
  ProgressIndicator,
  Text,
}

type Props = {
  icon?: IconType
  iconColor?: AllowedColors
  focusOnMount?: boolean
  size: 'small' | 'full-width' // only affects desktop (https://zpl.io/aMW5AG3)
  onChange?: (text: string) => void
  placeholderText: string
  placeholderCentered?: boolean
  style?: Styles.StylesCrossPlatform
  valueControlled?: boolean
  value?: string
  waiting?: boolean
  mobileCancelButton?: boolean // show "Cancel" on the left
  showXOverride?: boolean
  dummyInput?: boolean
  onBlur?: () => void
  onCancel?: () => void
  // If onClick is provided, this component won't focus on click. User is
  // expected to handle actual filter/search in a separate component, perhaps
  // in a popup.
  onClick?: () => void
  onFocus?: () => void
  // following props are ignored when onClick is provided
  hotkey?: 'f' | 'k' // desktop only,
  // Maps to onSubmitEditing on native
  onEnterKeyDown?: (event?: React.BaseSyntheticEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  onKeyUp?: (event: React.KeyboardEvent) => void
  onKeyPress?: (event: NativeSyntheticEvent<{key: string}>) => void
  measureRef?: React.RefObject<MeasureRef>
}

export type SearchFilterRef = {
  blur: () => void
  focus: () => void
}
const SearchFilter = React.forwardRef<SearchFilterRef, Props>((props, ref) => {
  const {onChange} = props
  const [focused, setFocused] = React.useState(props.focusOnMount || false)
  const [hover, setHover] = React.useState(false)
  const [text, setText] = React.useState('')
  const inputRef = React.useRef<PlainInput>(null)
  const mounted = React.useRef(false)

  const focusOnMountRef = React.useRef(props.focusOnMount)

  React.useEffect(() => {
    mounted.current = true
    let id = 0
    if (focusOnMountRef.current) {
      focusOnMountRef.current = false
      id = setTimeout(() => {
        if (mounted.current) {
          inputRef.current?.focus()
        }
      }, 20) as unknown as number
    }
    return () => {
      mounted.current = false
      clearTimeout(id)
    }
  }, [])

  const onBlur = () => {
    setFocused(false)
    props.onBlur?.()
  }

  const onFocus = () => {
    setFocused(true)
    props.onFocus?.()
  }

  const currentText = () => (props.valueControlled ? props.value : text)

  const focus = React.useCallback(() => {
    inputRef.current?.focus()
  }, [])

  const blur = React.useCallback(() => {
    inputRef.current?.blur()
  }, [])

  React.useImperativeHandle(ref, () => ({blur, focus}))

  const update = React.useCallback(
    (text: string) => {
      setText(text)
      onChange?.(text)
    },
    [onChange]
  )

  const clear = React.useCallback(() => {
    update('')
  }, [update])

  const cancel = (e?: React.BaseSyntheticEvent) => {
    blur()
    props.onCancel ? props.onCancel() : clear()
    e?.stopPropagation()
  }

  const mouseOver = () => setHover(true)
  const mouseLeave = () => setHover(false)

  const onHotkey = (cmd: string) => {
    props.hotkey && cmd.endsWith('+' + props.hotkey) && focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.key === 'Escape' && cancel(e)
    props.onKeyDown?.(e)
  }

  const typing = () => focused || !!currentText()

  const keyHandler = () => {
    return (
      !Styles.isMobile &&
      props.hotkey &&
      !props.onClick && <Kb.HotKey onHotKey={onHotkey} hotKeys={`mod+${props.hotkey}`} />
    )
  }

  const iconSizeType = () => {
    return !Styles.isMobile && props.size === 'full-width' ? 'Default' : 'Small'
  }

  const iconColor = () => {
    return props.iconColor ? props.iconColor : Styles.globalColors.black_50
  }

  const leftIcon = () => {
    return (
      props.icon &&
      !typing() && (
        <Kb.Icon
          type={props.icon}
          sizeType={iconSizeType()}
          color={iconColor()}
          boxStyle={styles.icon}
          style={!Styles.isMobile && props.size === 'small' ? styles.leftIconXTiny : styles.leftIconTiny}
        />
      )
    )
  }

  const input = () => {
    const hotkeyText =
      props.hotkey && !props.onClick && !focused && !Styles.isMobile
        ? ` (${Platforms.shortcutSymbol}${props.hotkey.toUpperCase()})`
        : ''
    return (
      <Kb.NewInput
        flexable={true}
        autoFocus={props.focusOnMount}
        value={currentText()}
        placeholder={props.placeholderText + hotkeyText}
        dummyInput={props.dummyInput}
        onChangeText={update}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onKeyUp={props.onKeyUp}
        onKeyPress={props.onKeyPress}
        onEnterKeyDown={props.onEnterKeyDown}
        ref={inputRef}
        hideBorder={true}
        containerStyle={styles.inputContainer}
        style={styles.input}
      />
    )
  }

  const waiting = () => {
    return (
      !!props.waiting &&
      (Styles.isMobile ? (
        <Kb.ProgressIndicator type="Small" style={styles.spinnerMobile} white={false} />
      ) : (
        <Kb.Animation
          animationType={'spinner'}
          containerStyle={styles.icon}
          style={props.size === 'full-width' ? styles.spinnerFullWidth : styles.spinnerSmall}
        />
      ))
    )
  }

  const rightCancelIcon = () => {
    let show = typing()
    if (props.showXOverride === true) {
      show = true
    }
    if (props.showXOverride === false) {
      show = false
    }
    if (!show) {
      return null
    }
    if (Styles.isMobile) {
      return (
        <Kb.ClickableBox2 onClick={props.mobileCancelButton ? clear : cancel} hitSlop={10}>
          <Kb.Icon
            type="iconfont-remove"
            sizeType={iconSizeType()}
            color={iconColor()}
            style={styles.removeIconNonFullWidth}
          />
        </Kb.ClickableBox2>
      )
    } else {
      return (
        <Kb.ClickableBox
          onClick={() => {}}
          onMouseDown={cancel}
          style={props.size === 'full-width' ? styles.removeIconFullWidth : styles.removeIconNonFullWidth}
        >
          <Kb.Icon
            type="iconfont-remove"
            sizeType={iconSizeType()}
            color={iconColor()}
            boxStyle={styles.icon}
          />
        </Kb.ClickableBox>
      )
    }
  }

  const content = (
    <Kb.ClickableBox
      style={Styles.collapseStyles([
        styles.container,
        props.placeholderCentered && styles.containerCenter,
        !Styles.isMobile && props.size === 'small' && styles.containerSmall,
        (Styles.isMobile || props.size === 'full-width') && styles.containerNonSmall,
        focused || hover ? styles.light : styles.dark,
        !Styles.isMobile && props.style,
      ])}
      onMouseOver={mouseOver}
      onMouseLeave={mouseLeave}
      onClick={props.onClick || (Styles.isMobile || !focused ? focus : undefined)}
      underlayColor={Styles.globalColors.transparent}
      hoverColor={Styles.globalColors.transparent}
    >
      <Kb.Box2Measure
        ref={props.measureRef}
        direction="horizontal"
        style={Styles.collapseStyles([{alignItems: 'center'}, !Styles.isMobile && {width: '100%'}])}
        pointerEvents={Styles.isMobile && props.onClick ? 'none' : undefined}
      >
        {keyHandler()}
        {leftIcon()}
        {input()}
        {waiting()}
        {rightCancelIcon()}
      </Kb.Box2Measure>
    </Kb.ClickableBox>
  )

  return Styles.isMobile ? (
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([styles.containerMobile, props.style])}
      alignItems="center"
      gap="xsmall"
    >
      {!!props.mobileCancelButton && typing() && (
        <Kb.Text type={'BodyBigLink'} onClick={cancel}>
          Cancel
        </Kb.Text>
      )}
      {content}
    </Kb.Box2>
  ) : (
    content
  )
})

export default SearchFilter

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.globalStyles.flexGrow,
      alignItems: 'center',
      borderRadius: Styles.borderRadius,
      flexShrink: 1,
    },
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
      cursor: 'text',
    },
  }),
  containerCenter: {justifyContent: 'center'},
  containerMobile: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.tiny,
    },
    isTablet: {
      paddingLeft: 0,
      paddingRight: 0,
    },
  }),
  containerNonSmall: {
    height: 32,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },
  containerSmall: {
    height: 28,
    maxWidth: 280,
    minWidth: 80,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
  },
  dark: {backgroundColor: Styles.globalColors.black_10},
  icon: Styles.platformStyles({
    isElectron: {marginTop: 2},
  }),
  input: {backgroundColor: Styles.globalColors.transparent},
  inputContainer: {
    ...Styles.globalStyles.flexGrow,
    backgroundColor: Styles.globalColors.transparent,
    flexShrink: 1,
    paddingLeft: 0,
    paddingRight: 0,
  },
  inputNoGrow: {flexGrow: 0},
  leftIconTiny: {marginRight: Styles.globalMargins.tiny},
  leftIconXTiny: {marginRight: Styles.globalMargins.xtiny},
  light: {backgroundColor: Styles.globalColors.black_05},
  removeIconFullWidth: {marginLeft: Styles.globalMargins.xsmall},
  removeIconNonFullWidth: {marginLeft: Styles.globalMargins.tiny},
  spinnerFullWidth: {
    height: 20,
    marginLeft: Styles.globalMargins.xsmall,
    width: 20,
  },
  spinnerMobile: {marginLeft: Styles.globalMargins.tiny},
  spinnerSmall: {
    height: 16,
    marginLeft: Styles.globalMargins.tiny,
    width: 16,
  },
}))
