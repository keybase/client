import * as React from 'react'
import * as Styles from '@/styles'
import type {Props, TextInfo, RefType} from './input2'
import {isIOS} from '@/constants/platform'
import {getTextStyle} from './text'
import {TextInput, type NativeSyntheticEvent, type TextInputSelectionChangeEventData} from 'react-native'
import {useColorScheme} from 'react-native'

export const Input2 = React.memo(
  React.forwardRef<RefType, Props>(function Input2(p, ref) {
    const {style: _style, onChangeText: _onChangeText, multiline, placeholder} = p
    const {textType = 'Body', rowsMax, rowsMin, padding, disabled /*, onPasteImage*/} = p
    const {
      autoFocus: _autoFocus,
      autoCorrect,
      autoCapitalize,
      onBlur,
      onFocus,
      onSelectionChange: _onSelectionChange,
    } = p

    const isDarkMode = useColorScheme() === 'dark'
    const [autoFocus, setAutoFocus] = React.useState(_autoFocus)
    const [value, setValue] = React.useState('')
    const [selection, setSelection] = React.useState<{start: number; end?: number | undefined} | undefined>(
      undefined
    )
    const inputRef = React.useRef<TextInput | null>(null)

    const setInputRef = React.useCallback((ti: TextInput | null) => {
      inputRef.current = ti
    }, [])

    const onChangeText = React.useCallback(
      (s: string) => {
        setValue(s)
        _onChangeText?.(s)
      },
      [_onChangeText]
    )
    const onSelectionChange = React.useCallback(
      (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        setSelection(e.nativeEvent.selection)
        _onSelectionChange?.(e)
      },
      [_onSelectionChange]
    )

    React.useImperativeHandle(ref, () => {
      const i = inputRef.current
      return {
        blur: () => {
          i?.blur()
        },
        clear: () => {
          setValue('')
          onChangeText('')
          setAutoFocus(true)
        },
        focus: () => {
          i?.focus()
        },
        getSelection: () => {
          return selection
        },
        isFocused: () => !!inputRef.current?.isFocused(),
        transformText: (fn: (textInfo: TextInfo) => TextInfo, reflectChange: boolean): void => {
          const ti = fn({selection, text: value})
          if (!reflectChange) {
            return
          }
          onChangeText(ti.text)
          setSelection(ti.selection)
        },
        get value() {
          return value
        },
      }
    }, [onChangeText, selection, value])

    const style = React.useMemo(() => {
      let textStyle = getTextStyle(textType, isDarkMode)
      // RN TextInput plays better without this
      if (isIOS) {
        const {lineHeight, ...rest} = textStyle
        textStyle = rest
      }
      const commonStyle = Styles.collapseStyles([styles.common, textStyle])

      const lineHeight = textStyle.lineHeight
      let lineStyle = new Array<Styles.StylesCrossPlatform>()
      if (multiline) {
        const defaultRowsToShow = Math.min(2, rowsMax ?? 2)
        const paddingStyles = padding ? Styles.padding(Styles.globalMargins[padding]) : {}
        lineStyle = [
          styles.multiline,
          {
            minHeight: (rowsMin || defaultRowsToShow) * (lineHeight ?? 0),
          },
          !!rowsMax && {maxHeight: rowsMax * (lineHeight ?? 0)},
          paddingStyles,
        ]
      } else {
        lineStyle = [styles.singleline, {maxHeight: lineHeight, minHeight: lineHeight}]
      }

      return Styles.collapseStyles([commonStyle, ...lineStyle, _style])
    }, [_style, multiline, textType, padding, rowsMax, rowsMin, isDarkMode])

    // const onPasteImageImpl = React.useCallback(
    //   (error: string | null | undefined, files: Array<PastedFile>) => {
    //     if (error) {
    //       console.log('paste error', error)
    //     }
    //     if (onPasteImage) {
    //       const uris = files.map(f => f.uri)
    //       onPasteImage(uris)
    //     }
    //   },
    //   [onPasteImage]
    // )

    // disabling this feature for now. Seems hard to get this to work
    //const onPaste = onPasteImage ? onPasteImageImpl : undefined
    // if (onPaste) {
    //   return (
    //     <ImagePasteView
    //       autoCapitalize={autoCapitalize}
    //       autoCorrect={autoCorrect}
    //       autoFocus={autoFocus}
    //       blurOnSubmit={false}
    //       multiline={multiline}
    //       onBlur={onBlur}
    //       onChangeText={onChangeText}
    //       onFocus={onFocus}
    //       // @ts-ignore added by react-native-image-keyboard
    //       onImageChange={onPaste}
    //       onSelectionChange={onSelectionChange}
    //       placeholder={placeholder}
    //       readOnly={disabled}
    //       ref={setInputRef}
    //       selection={selection}
    //       style={style}
    //       value={value}
    //     />
    //   )
    // }

    return (
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        blurOnSubmit={false}
        multiline={multiline}
        onBlur={onBlur}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onSelectionChange={onSelectionChange}
        placeholder={placeholder}
        readOnly={disabled}
        ref={setInputRef}
        selection={selection}
        style={style}
        value={value}
      />
    )
  })
)

const styles = Styles.styleSheetCreate(() => ({
  common: {backgroundColor: Styles.globalColors.fastBlank, borderWidth: 0, flexGrow: 1},
  multiline: Styles.platformStyles({
    isMobile: {
      height: undefined,
      textAlignVertical: 'top', // android centers by default
    },
  }),
  singleline: {padding: 0},
}))
