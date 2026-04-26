import * as React from 'react'
import Animation from './animation'
import {Box2} from './box'
import ClickableBox, {ClickableBox2} from './clickable-box'
import Input3, {type Input3Ref} from './input3'
import Text from './text'
import type {AllowedColors} from './text.shared'
import ProgressIndicator from './progress-indicator'
import {useHotKey} from './hot-key'
import type {IconType} from './icon.constants-gen'
import IconAuto from './icon-auto'
import Icon from './icon'
import * as Styles from '@/styles'
import * as Platforms from '@/constants/platform'
import type {MeasureRef} from './measure-ref'

const Kb = {
  Animation,
  Box2,
  ClickableBox,
  ClickableBox2,
  Icon,
  IconAuto,
  Input3,
  ProgressIndicator,
  Text,
  useHotKey,
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
  measureRef?: React.RefObject<MeasureRef | null>
}

export type SearchFilterRef = {
  blur: () => void
  focus: () => void
}
function SearchFilter(props: Props & {ref?: React.Ref<SearchFilterRef>}) {
  const {onChange, onBlur: _onBlur, onFocus: _onFocus, hotkey} = props
  const {onKeyDown: _onKeyDown, onCancel, measureRef, ref} = props
  const [focused, setFocused] = React.useState(props.focusOnMount || false)
  const [hover, setHover] = React.useState(false)
  const [text, setText] = React.useState('')
  const inputRef = React.useRef<Input3Ref>(null)
  const mounted = React.useRef(false)

  const focusOnMountRef = React.useRef(props.focusOnMount)

  React.useEffect(() => {
    mounted.current = true
    let id: ReturnType<typeof setTimeout> | undefined
    if (focusOnMountRef.current) {
      focusOnMountRef.current = false
      id = setTimeout(() => {
        if (mounted.current) {
          inputRef.current?.focus()
        }
      }, 20)
    }
    return () => {
      mounted.current = false
      if (id !== undefined) clearTimeout(id)
    }
  }, [])

  const onBlur = () => {
    setFocused(false)
    _onBlur?.()
  }

  const onFocus = () => {
    setFocused(true)
    _onFocus?.()
  }

  const currentText = () => (props.valueControlled ? props.value : text)

  const focus = () => {
    inputRef.current?.focus()
  }

  const blur = () => {
    inputRef.current?.blur()
  }

  React.useImperativeHandle(ref, () => ({blur, focus}))

  const update = (text: string) => {
    setText(text)
    onChange?.(text)
  }

  const clear = () => {
    update('')
  }

  const cancel = (e?: React.BaseSyntheticEvent) => {
    blur()
    if (onCancel) {
      onCancel()
    } else {
      clear()
    }
    e?.stopPropagation()
  }

  const mouseOver = () => setHover(true)
  const mouseLeave = () => setHover(false)

  const onHotkey = (cmd: string) => {
    if (hotkey && !props.onClick && cmd.endsWith('+' + hotkey)) {
      focus()
    }
  }

  Kb.useHotKey(props.hotkey && !props.onClick ? `mod+${props.hotkey}` : '', onHotkey)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancel(e)
    }
    _onKeyDown?.(e)
  }

  const typing = () => focused || !!currentText()

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
        <Kb.IconAuto
          type={props.icon}
          sizeType={iconSizeType()}
          color={iconColor()}
          style={Styles.collapseStyles([styles.icon, !Styles.isMobile && props.size === 'small' ? styles.leftIconXTiny : styles.leftIconTiny])}
        />
      )
    )
  }

  const input = () => {
    const hotkeyText =
      props.hotkey && !props.onClick && !focused && !Styles.isMobile
        ? ` (${Platforms.shortcutSymbol}${props.hotkey.toUpperCase()})`
        : ''
    const textValue = currentText()
    return (
      <Kb.Input3
        placeholder={props.placeholderText + hotkeyText}
        onChangeText={update}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        ref={inputRef}
        hideBorder={true}
        containerStyle={styles.inputContainer}
        inputStyle={styles.input}
        {...(props.focusOnMount === undefined ? {} : {autoFocus: props.focusOnMount})}
        {...(textValue === undefined ? {} : {value: textValue})}
        {...(props.onEnterKeyDown === undefined ? {} : {onEnterKeyDown: props.onEnterKeyDown})}
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
          />
        </Kb.ClickableBox>
      )
    }
  }

  const insideBoxProps = {
    ...(measureRef === undefined ? {} : {ref: measureRef}),
    ...(Styles.isMobile && props.onClick ? {pointerEvents: 'none' as const} : {}),
  }

  const inside = (
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([{alignItems: 'center'}, !Styles.isMobile && {width: '100%'}])}
      {...insideBoxProps}
    >
      {leftIcon()}
      {input()}
      {waiting()}
      {rightCancelIcon()}
    </Kb.Box2>
  )

  const desktopOnClick = props.onClick || (!focused ? focus : undefined)
  const content = Styles.isMobile ? (
    <Kb.ClickableBox2
      data-search-filter={true}
      style={Styles.collapseStyles([
        styles.container,
        props.placeholderCentered && styles.containerCenter,
        styles.containerNonSmall,
        focused || hover ? styles.light : styles.dark,
      ])}
      onClick={props.onClick || focus}
    >
      {inside}
    </Kb.ClickableBox2>
  ) : (
    <Kb.ClickableBox
      data-search-filter={true}
      style={Styles.collapseStyles([
        styles.container,
        props.placeholderCentered && styles.containerCenter,
        props.size === 'small' && styles.containerSmall,
        props.size === 'full-width' && styles.containerNonSmall,
        focused || hover ? styles.light : styles.dark,
        props.style,
      ])}
      onMouseOver={mouseOver}
      onMouseLeave={mouseLeave}
      underlayColor={Styles.globalColors.transparent}
      hoverColor={Styles.globalColors.transparent}
      {...(desktopOnClick === undefined ? {} : {onClick: desktopOnClick})}
    >
      {inside}
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
}

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
