import * as React from 'react'
import * as Styles from '@/styles'
import type {Props, TextInfo, RefType} from './input'
import {isIOS} from '@/constants/platform'
import {getTextStyle} from './text.styles'
import {
  TextInput,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
  Keyboard,
} from 'react-native'
import {useColorScheme} from 'react-native'
import {registerPasteImage} from 'react-native-kb'

export function Input(p: Props & {ref?: React.Ref<RefType>}) {
    const {style: _style, onChangeText: _onChangeText, multiline, placeholder, ref} = p
    const {textType = 'Body', rowsMax, rowsMin, padding, disabled, onPasteImage} = p
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

    const setInputRef = (ti: TextInput | null) => {
      inputRef.current = ti
    }

    const onChangeTextRef = React.useRef(_onChangeText)
    React.useEffect(() => {
      onChangeTextRef.current = _onChangeText
    })
    const [onChangeText] = React.useState(() => (s: string) => {
      setValue(s)
      onChangeTextRef.current?.(s)
    })
    const onSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      setSelection(e.nativeEvent.selection)
      _onSelectionChange?.(e)
    }

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

    const style = (() => {
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
    })()

    const onPasteImageImpl = (uris: Array<string>) => {
      if (onPasteImage) {
        onPasteImage(uris)
      }
    }

    const onPaste = onPasteImage ? onPasteImageImpl : undefined

    React.useEffect(() => {
      if (!onPaste) return
      const dereg = registerPasteImage(uris => {
        Keyboard.dismiss()
        onPaste(uris)
      })
      return () => {
        dereg()
      }
    }, [onPaste])

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
}

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
