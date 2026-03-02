import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import Icon from './icon'
import Text from './text'
import {getTextStyle} from './text.styles'
import {useColorScheme} from 'react-native'
import './input.css'
import type {Input3Props, Input3Ref} from './input3'

function Input3(props: Input3Props & {ref?: React.Ref<Input3Ref>}) {
  const {autoCapitalize, autoCorrect, autoFocus, containerStyle, decoration, disabled} = props
  const {error, growAndScroll, hideBorder, icon, inputStyle, maxLength, multiline, selectTextOnFocus} = props
  const {onBlur: onBlurProp, onChangeText, onEnterKeyDown, onFocus: onFocusProp, onKeyDown: onKeyDownProp} = props
  const {placeholder, prefix, ref, rowsMax, rowsMin, secureTextEntry, textType = 'BodySemibold', value} = props

  const [focused, setFocused] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const isComposingRef = React.useRef(false)
  const isDarkMode = useColorScheme() === 'dark'

  const onFocus = () => {
    if (disabled) return
    setFocused(true)
    if (selectTextOnFocus) {
      inputRef.current?.select()
    }
    onFocusProp?.()
  }

  const onBlur = () => {
    setFocused(false)
    onBlurProp?.()
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChangeText?.(e.target.value)
  }

  const onCompositionStart = () => {
    isComposingRef.current = true
  }

  const onCompositionEnd = () => {
    isComposingRef.current = false
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isComposingRef.current) return
    onKeyDownProp?.(e)
    if (e.key === 'Enter' && !(e.shiftKey || e.ctrlKey || e.altKey)) {
      onEnterKeyDown?.(e)
    }
  }

  const isControlled = typeof value === 'string'

  React.useImperativeHandle(ref, () => ({
    blur: () => inputRef.current?.blur(),
    clear: () => {
      if (isControlled) {
        onChangeText?.('')
      } else if (inputRef.current) {
        inputRef.current.value = ''
      }
    },
    focus: () => inputRef.current?.focus(),
  }))

  const textStyle = getTextStyle(textType, isDarkMode)
  const fontSize = textStyle.fontSize

  const rows = rowsMin || Math.min(2, rowsMax || 2)
  const lineHeight =
    textStyle.lineHeight === undefined ? 20 : typeof textStyle.lineHeight === 'string' ? parseInt(textStyle.lineHeight, 10) || 20 : textStyle.lineHeight

  const commonInputProps = {
    autoCapitalize,
    autoCorrect: autoCorrect === undefined ? undefined : autoCorrect ? 'on' : 'off',
    autoFocus,
    maxLength,
    onBlur,
    onChange,
    onCompositionEnd,
    onCompositionStart,
    onFocus,
    onKeyDown,
    placeholder,
    ref: inputRef,
    value,
    ...(disabled ? {readOnly: true as const} : {}),
  }

  const inputElement = multiline ? (
    <textarea
      {...commonInputProps}
      ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      rows={rows}
      style={
        Styles.collapseStyles([
          textStyle,
          styles.noChrome,
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
      {...commonInputProps}
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
          <Icon color={Styles.globalColors.black_20} type={icon} fontSize={fontSize} style={styles.displayFlex} />
        </Box2>
      )}
      {!!prefix && <Text type="BodySemibold" style={styles.prefix}>{prefix}</Text>}
      {inputElement}
      {decoration}
    </Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.white,
        borderColor: Styles.globalColors.black_10,
        borderRadius: Styles.borderRadius,
        borderStyle: 'solid',
        borderWidth: 1,
        padding: Styles.globalMargins.xtiny,
        width: '100%',
      },
      disabled: {opacity: 0.4},
      displayFlex: {display: 'flex'},
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
      multiline: Styles.platformStyles({
        isElectron: {
          fieldSizing: 'content',
          paddingBottom: 0,
          paddingTop: 0,
          resize: 'none',
          width: '100%',
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
      singleline: {
        flex: 1,
        minWidth: 0,
        width: '100%',
      },
    }) as const
)

export default Input3
