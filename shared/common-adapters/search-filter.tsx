import * as React from 'react'
import Animation from './animation'
import {Box2, ClickableBox} from './box'
import Input3 from './input3'
import type {Input3Ref} from './input3.shared'
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
  // in a popup. The hotkey triggers onClick instead of focusing.
  onClick?: () => void
  onFocus?: () => void
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
  const styles = useStyles()
  const theme = Styles.useTheme()
  const {
    onChange,
    onBlur: _onBlur,
    onFocus: _onFocus,
    hotkey,
    focusOnMount,
    icon,
    iconColor: _iconColor,
    mobileCancelButton,
    onClick,
    onEnterKeyDown,
    placeholderCentered,
    placeholderText,
    showXOverride,
    size,
    style,
    value,
    valueControlled,
    waiting: _waiting,
  } = props
  const {onKeyDown: _onKeyDown, onCancel, measureRef, ref} = props
  const [focused, setFocused] = React.useState(focusOnMount || false)
  const [hover, setHover] = React.useState(false)
  const [text, setText] = React.useState('')
  const inputRef = React.useRef<Input3Ref>(null)
  const mounted = React.useRef(false)

  const focusOnMountRef = React.useRef(focusOnMount)

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

  const currentText = () => (valueControlled ? value : text)

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
    if (hotkey && cmd.endsWith('+' + hotkey)) {
      if (onClick) {
        onClick()
      } else {
        focus()
      }
    }
  }

  Kb.useHotKey(hotkey ? `mod+${hotkey}` : '', onHotkey)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancel(e)
    }
    _onKeyDown?.(e)
  }

  const typing = () => focused || !!currentText()

  const iconSizeType = () => {
    return !isMobile && size === 'full-width' ? 'Default' : 'Small'
  }

  const iconColor = () => {
    return _iconColor ? _iconColor : theme.black_50
  }

  const leftIcon = () => {
    return (
      icon &&
      !typing() && (
        <Kb.IconAuto
          type={icon}
          sizeType={iconSizeType()}
          color={iconColor()}
          style={Styles.collapseStyles([styles.icon, !isMobile && size === 'small' ? styles.leftIconXTiny : styles.leftIconTiny])}
        />
      )
    )
  }

  const input = () => {
    const hotkeyText =
      hotkey && !focused && !isMobile ? ` (${Platforms.shortcutSymbol}${hotkey.toUpperCase()})` : ''
    return (
      <Kb.Input3
        textType="BodySemibold"
        autoFocus={focusOnMount}
        value={currentText()}
        placeholder={placeholderText + hotkeyText}
        onChangeText={update}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onEnterKeyDown={onEnterKeyDown}
        ref={inputRef}
        hideBorder={true}
        containerStyle={styles.inputContainer}
        inputStyle={styles.input}
      />
    )
  }

  const waiting = () => {
    return (
      !!_waiting &&
      (isMobile ? (
        <Kb.ProgressIndicator type="Small" style={styles.spinnerMobile} white={false} />
      ) : (
        <Kb.Animation
          animationType={'spinner'}
          containerStyle={styles.icon}
          style={size === 'full-width' ? styles.spinnerFullWidth : styles.spinnerSmall}
        />
      ))
    )
  }

  const rightCancelIcon = () => {
    let show = typing()
    if (showXOverride === true) {
      show = true
    }
    if (showXOverride === false) {
      show = false
    }
    if (!show) {
      return null
    }
    if (isMobile) {
      return (
        <Kb.ClickableBox onClick={mobileCancelButton ? clear : cancel} hitSlop={10} direction="vertical">
          <Kb.Icon
            type="iconfont-remove"
            sizeType={iconSizeType()}
            color={iconColor()}
            style={styles.removeIconNonFullWidth}
          />
        </Kb.ClickableBox>
      )
    } else {
      return (
        <Kb.ClickableBox
          onClick={() => {}}
          onMouseDown={cancel}
          direction="vertical"
          style={size === 'full-width' ? styles.removeIconFullWidth : styles.removeIconNonFullWidth}
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

  const inside = (
    <Kb.Box2
      ref={measureRef}
      direction="horizontal"
      alignItems="center"
      fullWidth={!isMobile}
      // With onClick the input is display-only; block it from taking focus so
      // clicks hit the ClickableBox and window refocus can't refire onFocus.
      pointerEvents={onClick ? 'none' : undefined}
    >
      {leftIcon()}
      {input()}
      {waiting()}
      {rightCancelIcon()}
    </Kb.Box2>
  )

  const content = isMobile ? (
    <Kb.ClickableBox
      data-search-filter={true}
      direction="horizontal"
      style={Styles.collapseStyles([
        styles.container,
        placeholderCentered && styles.containerCenter,
        styles.containerNonSmall,
        focused || hover ? styles.light : styles.dark,
      ])}
      onClick={onClick || focus}
    >
      {inside}
    </Kb.ClickableBox>
  ) : (
    <Kb.ClickableBox
      data-search-filter={true}
      direction="horizontal"
      alignSelf={size === 'full-width' ? 'stretch' : undefined}
      style={Styles.collapseStyles([
        styles.container,
        placeholderCentered && styles.containerCenter,
        size === 'small' && styles.containerSmall,
        size === 'full-width' && styles.containerNonSmall,
        focused || hover ? styles.light : styles.dark,
        style,
      ])}
      onMouseOver={mouseOver}
      onMouseLeave={mouseLeave}
      onClick={onClick || (!focused ? focus : undefined)}
    >
      {inside}
    </Kb.ClickableBox>
  )

  return isMobile ? (
    <Kb.Box2
      direction="horizontal"
      style={Styles.collapseStyles([styles.containerMobile, style])}
      alignItems="center"
      gap="xsmall"
    >
      {!!mobileCancelButton && typing() && (
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

const useStyles = Styles.createStyleHook(theme => ({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexGrow,
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
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
    },
    isTablet: {
      ...Styles.paddingH(0),
    },
  }),
  containerNonSmall: {
    height: 32,
    ...Styles.paddingH(Styles.globalMargins.xsmall),
  },
  containerSmall: {
    height: 28,
    maxWidth: 280,
    minWidth: 80,
    ...Styles.paddingH(Styles.globalMargins.tiny),
  },
  dark: {backgroundColor: theme.black_10},
  icon: Styles.platformStyles({
    isElectron: {marginTop: 2},
  }),
  input: {backgroundColor: theme.transparent},
  inputContainer: {
    ...Styles.globalStyles.flexGrow,
    backgroundColor: theme.transparent,
    flexShrink: 1,
    ...Styles.paddingH(0),
  },
  leftIconTiny: {marginRight: Styles.globalMargins.tiny},
  leftIconXTiny: {marginRight: Styles.globalMargins.xtiny},
  light: {backgroundColor: theme.black_05},
  removeIconFullWidth: {marginLeft: Styles.globalMargins.xsmall},
  removeIconNonFullWidth: {marginLeft: Styles.globalMargins.tiny},
  spinnerFullWidth: {
    ...Styles.size(20),
    marginLeft: Styles.globalMargins.xsmall,
  },
  spinnerMobile: {marginLeft: Styles.globalMargins.tiny},
  spinnerSmall: {
    ...Styles.size(16),
    marginLeft: Styles.globalMargins.tiny,
  },
}))
