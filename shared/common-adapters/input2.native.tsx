import * as React from 'react'
import * as Styles from '@/styles'
import type {Props, TextInfo, RefType} from './input2'
import {isIOS} from '@/constants/platform'
import {getStyle as getTextStyle} from './text'
import {TextInput, type NativeSyntheticEvent, type TextInputSelectionChangeEventData} from 'react-native'

export const Input2 = React.memo(
  React.forwardRef<RefType, Props>(function Input2(p, ref) {
    const {style: _style, onChangeText: _onChangeText, multiline, placeholder} = p
    const {textType = 'Body', rowsMax, rowsMin, padding, disabled, autoFocus} = p

    const [value, setValue] = React.useState('')
    const [selection, setSelection] = React.useState<{start: number; end?: number | undefined} | undefined>(
      undefined
    )
    const inputRef = React.useRef<TextInput>(null)
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
      },
      []
    )

    React.useImperativeHandle(ref, () => {
      const i = inputRef.current
      return {
        blur: () => {
          i?.blur()
        },
        clear: () => {
          i?.clear()
        },
        focus: () => {
          i?.focus()
        },
        getSelection: () => {
          return selection
        },
        isFocused: () => !!inputRef.current?.isFocused(),
        // TEMP just placeholders
        transformText: (fn: (textInfo: TextInfo) => TextInfo, reflectChange: boolean): void => {
          const ti = fn({selection, text: value})
          if (reflectChange) {
            setValue(ti.text)
            setSelection(ti.selection)
          }
        },
        value,
      }
    }, [selection, value])

    const style = React.useMemo(() => {
      const textStyle = getTextStyle(textType)
      // RN TextInput plays better without this
      if (isIOS) {
        delete textStyle.lineHeight
      }
      const commonStyle = Styles.collapseStyles([styles.common, textStyle as any])

      const lineHeight = textStyle.lineHeight
      let lineStyle
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
    }, [_style, multiline, textType, padding, rowsMax, rowsMin])

    return (
      <TextInput
        autoFocus={autoFocus}
        placeholder={placeholder}
        readOnly={disabled}
        selection={selection}
        onSelectionChange={onSelectionChange}
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        style={style}
        blurOnSubmit={false}
        multiline={multiline}
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
