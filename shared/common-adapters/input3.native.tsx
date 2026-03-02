import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import Icon from './icon'
import Text from './text'
import {getTextStyle} from './text.styles'
import {TextInput as NativeTextInput} from 'react-native'
import {isIOS} from '@/constants/platform'
import {useColorScheme} from 'react-native'
import type {Input3Props, Input3Ref} from './input3'

function Input3(props: Input3Props & {ref?: React.Ref<Input3Ref>}) {
  const {autoCapitalize, autoCorrect, autoFocus, containerStyle, decoration, disabled} = props
  const {error, hideBorder, icon, inputStyle, keyboardType, maxLength, multiline} = props
  const {onBlur: onBlurProp, onChangeText, onEnterKeyDown, onFocus: onFocusProp} = props
  const {placeholder, prefix, ref, returnKeyType, rowsMax, rowsMin, secureTextEntry, textContentType, value} = props

  const [focused, setFocused] = React.useState(false)
  const inputRef = React.useRef<NativeTextInput>(null)
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

  const onSubmitEditing = () => {
    onEnterKeyDown?.()
  }

  const isControlled = typeof value === 'string'

  React.useImperativeHandle(ref, () => ({
    blur: () => inputRef.current?.blur(),
    clear: () => {
      if (isControlled) {
        onChangeText?.('')
      } else {
        inputRef.current?.clear()
      }
    },
    focus: () => inputRef.current?.focus(),
  }))

  let textStyle = getTextStyle('BodySemibold', isDarkMode)
  if (isIOS) {
    const {lineHeight: _, ...rest} = textStyle
    textStyle = rest
  }

  const fontSize = textStyle.fontSize
  const lineHeight = getTextStyle('BodySemibold', true).lineHeight ?? 20
  const defaultRows = Math.min(2, rowsMax || 2)
  const rows = rowsMin || defaultRows

  const inputElement = (
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
      onSubmitEditing={onSubmitEditing}
      placeholder={placeholder}
      placeholderTextColor={Styles.globalColors.black_35}
      ref={inputRef}
      returnKeyType={returnKeyType}
      secureTextEntry={secureTextEntry}
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
      },
      disabled: {opacity: 0.4},
      displayFlex: {display: 'flex'},
      error: {borderColor: Styles.globalColors.red},
      focused: {borderColor: Styles.globalColors.blue},
      hideBorder: {borderWidth: 0},
      icon: {marginRight: Styles.globalMargins.xtiny},
      input: {
        backgroundColor: Styles.globalColors.fastBlank,
        borderWidth: 0,
        flexGrow: 1,
      },
      multiline: Styles.platformStyles({
        isMobile: {
          height: undefined,
          textAlignVertical: 'top',
        },
      }),
      prefix: {marginRight: Styles.globalMargins.xtiny},
    }) as const
)

export default Input3
