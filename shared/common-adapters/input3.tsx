import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import IconAuto from './icon-auto'
import Text from './text'
import {getTextStyle} from './text.styles'
import {useColorScheme, TextInput as _TextInputReal} from 'react-native'
const NativeTextInput = _TextInputReal as unknown as React.ComponentType<{autoCapitalize?: string; autoCorrect?: boolean; autoFocus?: boolean; blurOnSubmit?: boolean; editable?: boolean; keyboardType?: string; maxLength?: number; multiline?: boolean; onBlur?: () => void; onChangeText?: (text: string) => void; onFocus?: () => void; onSubmitEditing?: () => void; placeholder?: string; placeholderTextColor?: string; ref?: React.Ref<InputLikeRef>; returnKeyType?: string; secureTextEntry?: boolean; selectTextOnFocus?: boolean; style?: Styles.StylesCrossPlatform; textContentType?: string; underlineColorAndroid?: string; value?: string}>
import type {Input3Props, Input3Ref} from './input3.shared'
export type {Input3Props, Input3Ref} from './input3.shared'

// Desktop only CSS import
import './input.css'

// Stub types to avoid DOM lib dependency in native tsconfig
type InputLikeRef = {
  blur?: () => void
  focus?: () => void
  select?: () => void
  clear?: () => void
  value?: string
}
type InputChangeEvent = {target: {value: string}}
type InputKeyEvent = {
  key?: string
  shiftKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
}

const DesktopInput3 = (props: Input3Props & {ref?: React.Ref<Input3Ref>}) => {
  const {
    autoCapitalize, autoCorrect, autoFocus, containerStyle, decoration, disabled, error,
    growAndScroll, hideBorder, icon, inputStyle, maxLength, multiline, selectTextOnFocus,
    onBlur: onBlurProp, onChangeText, onClick, onEnterKeyDown, onFocus: onFocusProp,
    onKeyDown: onKeyDownProp, placeholder, prefix, ref, rowsMax, rowsMin,
    secureTextEntry, spellCheck, textType = 'BodySemibold', value,
  } = props

  const [focused, setFocused] = React.useState(false)
  const inputRef = React.useRef<InputLikeRef>(null)
  const isComposingRef = React.useRef(false)
  const isDarkMode = useColorScheme() === 'dark'

  const onFocus = () => {
    if (disabled) return
    setFocused(true)
    if (selectTextOnFocus) {
      inputRef.current?.select?.()
    }
    onFocusProp?.()
  }

  const onBlur = () => {
    setFocused(false)
    onBlurProp?.()
  }

  const onChange = (e: InputChangeEvent) => {
    onChangeText?.(e.target.value)
  }

  const onKeyDown = (e: InputKeyEvent) => {
    if (isComposingRef.current) return
    onKeyDownProp?.(e as React.KeyboardEvent)
    if (e.key === 'Enter' && !(e.shiftKey || e.ctrlKey || e.altKey)) {
      onEnterKeyDown?.(e as React.KeyboardEvent)
    }
  }

  const isControlled = typeof value === 'string'

  React.useImperativeHandle(ref, () => ({
    blur: () => inputRef.current?.blur?.(),
    clear: () => {
      if (isControlled) {
        onChangeText?.('')
      } else if (inputRef.current) {
        inputRef.current.value = ''
      }
    },
    focus: () => inputRef.current?.focus?.(),
  }))

  const textStyle = getTextStyle(textType, isDarkMode)
  const fontSize = textStyle.fontSize
  const lineHeight =
    textStyle.lineHeight === undefined
      ? 20
      : typeof textStyle.lineHeight === 'string'
        ? parseInt(textStyle.lineHeight, 10) || 20
        : textStyle.lineHeight

  const rows = rowsMin || Math.min(2, rowsMax || 2)

  const commonInputProps = {
    autoCapitalize,
    autoCorrect: autoCorrect === undefined ? undefined : autoCorrect ? 'on' : 'off',
    autoFocus,
    maxLength,
    onBlur,
    onChange,
    onClick,
    onCompositionEnd: () => {
      isComposingRef.current = false
    },
    onCompositionStart: () => {
      isComposingRef.current = true
    },
    onFocus,
    onKeyDown,
    placeholder,
    ref: inputRef,
    spellCheck,
    value,
    ...(disabled ? {readOnly: true as const} : {}),
    'data-allow-keyboard-shortcuts': 'true',
  }

  const inputElement = multiline ? (
    <textarea
      {...(commonInputProps as unknown as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      rows={rows}
      style={
        Styles.collapseStyles([
          styles.noChrome,
          textStyle,
          styles.multiline,
          {minHeight: rows * lineHeight},
          rowsMax && {maxHeight: rowsMax * lineHeight},
          growAndScroll && styles.growAndScroll,
          inputStyle,
        ]) as React.CSSProperties
      }
    />
  ) : (
    <input
      {...(commonInputProps as unknown as React.InputHTMLAttributes<HTMLInputElement>)}
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={secureTextEntry ? 'password' : 'text'}
      style={
        Styles.collapseStyles([textStyle, styles.noChrome, styles.singleline, inputStyle]) as React.CSSProperties
      }
    />
  )

  return (
    <Box2
      direction="horizontal"
      style={Styles.collapseStyles([
        styles.container,
        focused && styles.focused,
        error && styles.error,
        hideBorder && styles.hideBorder,
        disabled && styles.disabled,
        containerStyle,
      ])}
    >
      {!!icon && (
        <Box2 direction="horizontal" style={styles.icon}>
          <IconAuto color={Styles.globalColors.black_20} type={icon} fontSize={fontSize} style={styles.displayFlex} />
        </Box2>
      )}
      {!!prefix && <Text type="BodySemibold" style={styles.prefix}>{prefix}</Text>}
      {inputElement}
      {decoration}
    </Box2>
  )
}

const NativeInput3 = (props: Input3Props & {ref?: React.Ref<Input3Ref>}) => {
  const {
    autoCapitalize, autoCorrect, autoFocus, containerStyle, decoration, disabled, error,
    hideBorder, icon, inputStyle, keyboardType, maxLength, multiline, onEnterKeyDown,
    onBlur: onBlurProp, onChangeText, onFocus: onFocusProp, placeholder, prefix, ref,
    returnKeyType, rowsMax, rowsMin, secureTextEntry, selectTextOnFocus,
    textContentType, textType = 'BodySemibold', value,
  } = props

  const [focused, setFocused] = React.useState(false)
  const inputRef = React.useRef<InputLikeRef>(null)
  const isDarkMode = useColorScheme() === 'dark'

  const onFocus = () => {
    if (disabled) return
    setFocused(true)
    onFocusProp?.()
  }

  const onBlur = () => {
    setFocused(false)
    onBlurProp?.()
  }

  const isControlled = typeof value === 'string'

  React.useImperativeHandle(ref, () => ({
    blur: () => inputRef.current?.blur?.(),
    clear: () => {
      if (isControlled) {
        onChangeText?.('')
      } else {
        inputRef.current?.clear?.()
      }
    },
    focus: () => inputRef.current?.focus?.(),
  }))

  let textStyle = getTextStyle(textType, isDarkMode)
  if (isIOS) {
    const {lineHeight: _, ...rest} = textStyle
    textStyle = rest
  }

  const fontSize = textStyle.fontSize
  const lineHeight = getTextStyle(textType, true).lineHeight ?? 20
  const rows = rowsMin || Math.min(2, rowsMax || 2)

  return (
    <Box2
      direction="horizontal"
      style={Styles.collapseStyles([
        styles.container,
        focused && styles.focused,
        error && styles.error,
        hideBorder && styles.hideBorder,
        disabled && styles.disabled,
        containerStyle,
      ])}
    >
      {!!icon && (
        <Box2 direction="horizontal" style={styles.icon}>
          <IconAuto color={Styles.globalColors.black_20} type={icon} fontSize={fontSize} style={styles.displayFlex} />
        </Box2>
      )}
      {!!prefix && <Text type="BodySemibold" style={styles.prefix}>{prefix}</Text>}
      <NativeTextInput
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={autoCorrect ?? false}
        autoFocus={autoFocus}
        blurOnSubmit={!multiline}
        editable={!disabled}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        multiline={multiline}
        onBlur={onBlur}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onSubmitEditing={onEnterKeyDown}
        placeholder={placeholder}
        placeholderTextColor={Styles.globalColors.black_35}
        ref={inputRef as React.Ref<InputLikeRef>}
        returnKeyType={returnKeyType}
        secureTextEntry={secureTextEntry}
        selectTextOnFocus={selectTextOnFocus}
        style={Styles.collapseStyles([
          textStyle,
          styles.input,
          multiline && styles.multiline,
          multiline && {minHeight: rows * lineHeight},
          multiline && rowsMax && {maxHeight: rowsMax * lineHeight},
          inputStyle,
        ])}
        textContentType={textContentType}
        underlineColorAndroid="transparent"
        value={value}
      />
      {decoration}
    </Box2>
  )
}

function Input3(props: Input3Props & {ref?: React.Ref<Input3Ref>}) {
  if (!isMobile) return <DesktopInput3 {...props} />
  return <NativeInput3 {...props} />
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Styles.globalColors.white,
          ...Styles.border(Styles.globalColors.black_10, 1, Styles.borderRadius),
          padding: Styles.globalMargins.xtiny,
        },
        isElectron: {
          width: '100%',
        },
      }),
      disabled: {opacity: 0.4},
      displayFlex: Styles.platformStyles({isElectron: {display: 'flex'}}),
      error: {borderColor: Styles.globalColors.red},
      focused: {borderColor: Styles.globalColors.blue},
      growAndScroll: Styles.platformStyles({
        isElectron: {
          fieldSizing: 'fixed',
          maxHeight: '100%',
          overflowY: 'auto',
          scrollbarGutter: 'stable',
        },
      }),
      hideBorder: {borderWidth: 0},
      icon: {marginRight: Styles.globalMargins.xtiny},
      input: Styles.platformStyles({
        isMobile: {
          borderWidth: 0,
          flexGrow: 1,
        },
      }),
      multiline: Styles.platformStyles({
        isElectron: {
          fieldSizing: 'content',
          paddingBottom: 0,
          paddingTop: 0,
          resize: 'none',
          width: '100%',
        },
        isMobile: {
          height: undefined,
          textAlignVertical: 'top',
        },
      }),
      noChrome: Styles.platformStyles({
        isElectron: {
          borderWidth: 0,
          lineHeight: 'unset',
          outline: 'none',
        },
      }),
      prefix: {marginRight: Styles.globalMargins.xtiny},
      singleline: Styles.platformStyles({
        isElectron: {
          flex: 1,
          minWidth: 0,
          width: '100%',
        },
      }),
    }) as const
)

export default Input3
