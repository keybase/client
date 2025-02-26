// Known issues:
// When input gets focus it shifts down 1 pixel when the cursor appears. This happens with a naked TextInput on RN...
import * as React from 'react'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text.native'
import * as Styles from '@/styles'
import {isIOS, isAndroid} from '@/constants/platform'
import {
  TextInput,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
  type TextInputSelectionChangeEventData,
} from 'react-native'
import type {KeyboardType, Props, Selection, TextInfo, InputRef} from './input'
import {checkTextInfo} from './input.shared'

const Input = React.forwardRef<InputRef, Props>((p, ref) => {
  const {...props} = p
  const {uncontrolled, value: _value, small, rowsMin, rowsMax, multiline, hideUnderline} = p
  const {onBlur: _onBlur, onFocus: _onFocus, errorText, onChangeText: _onChangeText} = p
  const {clearTextCounter, maxLength, autoCapitalize, autoFocus, autoCorrect, onEndEditing} = p
  const {onEnterKeyDown, hintText, returnKeyType, type, selectTextOnFocus, textContentType} = p
  const {inputStyle, style, hideLabel, smallLabel, smallLabelStyle, errorTextComponent, errorStyle} = p
  const {floatingHintTextOverride, keyboardType: _keyboardType, editable} = p

  const [focused, setFocused] = React.useState(false)
  const [height, setHeight] = React.useState<number | undefined>(undefined)

  const inputRef = React.useRef<TextInput>(null)
  // Needed to support wrapping with e.g. a ClickableBox. See
  // https://facebook.github.io/react-native/docs/direct-manipulation.html .
  const setNativeProps = React.useCallback((nativeProps: object) => {
    inputRef.current?.setNativeProps(nativeProps)
  }, [])

  const lastNativeTextRef = React.useRef<string | undefined>()
  const lastNativeSelectionRef = React.useRef<
    | {
        start: number | null
        end: number | null
      }
    | undefined
  >()

  const getValueImpl = React.useCallback(() => {
    return (uncontrolled ? lastNativeTextRef.current : _value) || ''
  }, [uncontrolled, _value])

  const getValue = React.useCallback((): string => {
    if (uncontrolled) {
      return getValueImpl()
    } else {
      throw new Error('getValue only supported on uncontrolled inputs')
    }
  }, [getValueImpl, uncontrolled])

  const selection = (): Selection => {
    return lastNativeSelectionRef.current || {end: 0, start: 0}
  }

  const lineHeight = (() => {
    if (small) {
      return 20
    } else if (multiline && isAndroid) {
      return 34
    } else return 28
  })()

  const rowsToHeight = (rows: number) => {
    const border = hideUnderline ? 0 : 1
    return rows * lineHeight + border
  }

  const onContentSizeChange = (event?: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    if (multiline && event?.nativeEvent.contentSize.height && event.nativeEvent.contentSize.width) {
      let h = event.nativeEvent.contentSize.height
      const minHeight = rowsMin && rowsToHeight(rowsMin)
      const maxHeight = rowsMax && rowsToHeight(rowsMax)
      if (minHeight && h < minHeight) {
        h = minHeight
      } else if (maxHeight && h > maxHeight) {
        h = maxHeight
      }
      setHeight(h)
    }
  }

  const underlineColor = (() => {
    if (hideUnderline) return Styles.globalColors.transparent
    if (errorText?.length) return Styles.globalColors.red
    return focused ? Styles.globalColors.blue : Styles.globalColors.black_10_on_white
  })()

  const onChangeText = (text: string) => {
    lastNativeTextRef.current = text
    _onChangeText?.(text)
  }

  const onSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const {start: _start, end: _end} = event.nativeEvent.selection
    // Work around Android bug which sometimes puts end before start:
    // https://github.com/facebook/react-native/issues/18579 .
    const start = Math.min(_start, _end)
    const end = Math.max(_start, _end)
    lastNativeSelectionRef.current = {end, start}
    // Bit of a hack here: Unlike the desktop case, where the text and
    // selection are updated simultaneously, on mobile the text gets
    // updated first, so handlers that rely on an updated selection
    // will get strange results. So trigger a text change notification
    // when the selection changes.
    _onChangeText?.(getValueImpl())
  }

  const timeoutIdsRef = React.useRef<Array<ReturnType<typeof setTimeout>>>([])
  const transformText = React.useCallback(
    (fn: (textInfo: TextInfo) => TextInfo) => {
      if (!uncontrolled) {
        throw new Error('transformText can only be called on uncontrolled components')
      }

      const textInfo: TextInfo = {
        selection: selection(),
        text: getValueImpl(),
      }
      const newTextInfo = fn(textInfo)
      checkTextInfo(newTextInfo)
      setNativeProps({text: newTextInfo.text})
      lastNativeTextRef.current = newTextInfo.text
      // Setting both the text and the selection at the same time
      // doesn't seem to work, but setting a short timeout to set the
      // selection does.
      const id = setTimeout(() => {
        // It's possible that, by the time this runs, the selection is
        // out of bounds with respect to the current text value. So fix
        // it up if necessary.
        const text = getValueImpl()
        let {start, end} = newTextInfo.selection
        end = Math.max(0, Math.min(end || 0, text.length))
        start = Math.max(0, Math.min(start || 0, end))
        const selection = {end, start}
        setNativeProps({selection})
        lastNativeSelectionRef.current = selection
      }, 0)
      timeoutIdsRef.current.push(id)
    },
    [getValueImpl, uncontrolled, setNativeProps]
  )

  React.useImperativeHandle(
    ref,
    () => ({
      blur: () => {
        inputRef.current?.blur()
      },
      focus: () => {
        inputRef.current?.focus()
      },
      getValue,
      select: () => {
        // Does nothing on mobile
      },
      selection,
      transformText,
    }),
    [getValue, transformText]
  )

  React.useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(clearTimeout)
      timeoutIdsRef.current = []
    }
  }, [])

  const lastClearTextCounterRef = React.useRef(clearTextCounter)
  React.useEffect(() => {
    if (lastClearTextCounterRef.current !== clearTextCounter) {
      lastClearTextCounterRef.current = clearTextCounter

      if (!uncontrolled) {
        throw new Error('clearTextCounter only works on uncontrolled components')
      }

      transformText(() => ({
        selection: {end: 0, start: 0},
        text: '',
      }))
    }
  }, [clearTextCounter, transformText, uncontrolled])

  const defaultRowsToShow = Math.min(2, rowsMax || 2)

  const value = getValueImpl()

  const floatingHintText =
    !!value.length &&
    (Object.hasOwn(props, 'floatingHintTextOverride') ? floatingHintTextOverride : hintText || ' ')

  let keyboardType: KeyboardType | undefined = _keyboardType
  if (!keyboardType) {
    if (isAndroid && type === 'passwordVisible') {
      keyboardType = 'visible-password'
    } else {
      // Defers to secureTextEntry when props.type === 'password'.
      keyboardType = 'default'
    }
  }

  const onFocus = () => {
    setFocused(true)
    _onFocus?.()
    setNativeProps({style: {textAlignVertical: 'top'}})
  }

  const onBlur = () => {
    setFocused(false)
    _onBlur?.()
  }

  // We want to be able to set the selection property,
  // too. Unfortunately, that triggers an Android crash:
  // https://github.com/facebook/react-native/issues/18316 .
  const inputProps = {
    autoCapitalize: autoCapitalize || 'none',
    autoCorrect: Object.hasOwn(props, 'autoCorrect') && autoCorrect,
    autoFocus,
    editable: Object.hasOwn(props, 'editable') ? editable : true,
    keyboardType,
    onBlur,
    onChangeText,
    onEndEditing,
    onFocus,
    onSelectionChange,
    onSubmitEditing: onEnterKeyDown,
    placeholder: hintText,
    placeholderTextColor: Styles.globalColors.black_40,
    ref: inputRef,
    returnKeyType,
    secureTextEntry: type === 'password',
    selectTextOnFocus,
    textContentType,
    underlineColorAndroid: 'transparent',
    ...(maxLength ? {maxLength: maxLength} : null),
    ...(uncontrolled ? null : {value}),
    ...(multiline
      ? {
          blurOnSubmit: false,
          multiline: true,
          onContentSizeChange,
          style: Styles.collapseStyles([
            styles.commonInput,
            {
              height: undefined,
              lineHeight,
              minHeight: rowsToHeight(rowsMin || defaultRowsToShow),
              paddingBottom: 0,
              paddingTop: 0,
              ...(rowsMax ? {maxHeight: rowsToHeight(rowsMax)} : null),
            },
            small ? styles.commonInputSmall : styles.commonInputRegular,
            // Override height if we received an onContentSizeChange() earlier.
            isIOS && height && {height: height},
            inputStyle,
          ]),
          ...(rowsMax ? {maxHeight: rowsToHeight(rowsMax)} : {}),
        }
      : {
          multiline: false,
          style: Styles.collapseStyles([
            styles.commonInput,
            {
              lineHeight,
              maxHeight: lineHeight, // ensure it doesn't grow or shrink
              minHeight: lineHeight,
              padding: 0,
            },
            small ? styles.commonInputSmall : styles.commonInputRegular,
            inputStyle,
          ]),
        }),
  } as const

  return (
    <Box
      style={Styles.collapseStyles([
        small
          ? ({
              ...Styles.globalStyles.flexBoxRow,
              backgroundColor: Styles.globalColors.fastBlank,
              borderBottomColor: underlineColor,
              borderBottomWidth: 1,
              flex: 1,
            } as const)
          : ({
              ...Styles.globalStyles.flexBoxColumn,
              backgroundColor: Styles.globalColors.fastBlank,
              justifyContent: 'flex-start',
              maxWidth: 400,
            } as const),
        style,
      ])}
    >
      {!small && !hideLabel && (
        <Text center={true} type="BodySmall" style={styles.floating}>
          {floatingHintText}
        </Text>
      )}
      {!!small && !!smallLabel && !hideLabel && (
        <Text
          type="BodySmall"
          style={Styles.collapseStyles([styles.smallLabel, {lineHeight}, smallLabelStyle])}
        >
          {smallLabel}
        </Text>
      )}
      <Box
        style={
          small ? styles.inputContainerSmall : [styles.inputContainer, {borderBottomColor: underlineColor}]
        }
      >
        <TextInput {...inputProps} />
      </Box>
      {!!errorTextComponent && errorTextComponent}
      {!small && (
        <Text center={true} type="BodySmallError" style={Styles.collapseStyles([styles.error, errorStyle])}>
          {errorText || ''}
        </Text>
      )}
    </Box>
  )
})

const styles = Styles.styleSheetCreate(() => {
  const _headerTextStyle = getTextStyle('Header')
  const _bodyTextStyle = getTextStyle('Body')
  const _bodySmallTextStyle = getTextStyle('BodySmall')
  const _bodyErrorTextStyle = getTextStyle('BodySmallError')
  return {
    commonInput: {
      backgroundColor: Styles.globalColors.fastBlank,
      borderWidth: 0,
      color: Styles.globalColors.black_on_white,
      flexGrow: 1,
    },
    commonInputRegular: {
      ...Styles.globalStyles.fontSemibold,
      fontSize: _headerTextStyle.fontSize,
      minWidth: 200,
      textAlign: 'center',
    },
    commonInputSmall: {
      ...Styles.globalStyles.fontRegular,
      fontSize: _bodyTextStyle.fontSize,
      textAlign: 'left',
    },

    error: {minHeight: _bodyErrorTextStyle.lineHeight},
    floating: {
      color: Styles.globalColors.blueDark,
      marginBottom: 9,
      minHeight: _bodySmallTextStyle.lineHeight,
    },
    inputContainer: {borderBottomWidth: 1},
    inputContainerSmall: {
      backgroundColor: Styles.globalColors.fastBlank,
      flex: 1,
    },
    smallLabel: {
      ...Styles.globalStyles.fontSemibold,
      color: Styles.globalColors.blueDark,
      fontSize: _headerTextStyle.fontSize,
      marginRight: 8,
    },
  }
})

export default Input
