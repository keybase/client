import * as React from 'react'
import * as Styles from '@/styles'
import type {Props, RefType, TextInfo} from './input2'
import {isIOS} from '@/constants/platform'
import {getTextStyle} from './text'
import {
  TextInput,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
  Keyboard,
} from 'react-native'
import {useColorScheme} from 'react-native'
import {
  useAnimatedRef,
  useHandler,
  useEvent,
  dispatchCommand,
  runOnJS,
  default as Animated,
} from 'react-native-reanimated'
import {registerPasteImage} from 'react-native-kb'

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

export const SyncInput = React.memo(
  React.forwardRef<RefType, Props>(function SyncInput(p, ref) {
    const {style: _style, onChangeText: _onChangeText, multiline, placeholder} = p
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
    const focusedRef = React.useRef(false)
    const animatedRef = useAnimatedRef<TextInput>()

    const updateFromWorklet = React.useCallback(
      (text: string) => {
        setValue(text)
        _onChangeText?.(text)
      },
      [_onChangeText]
    )
    const runUpdate = runOnJS(updateFromWorklet)

    const handlers = {
      onSync: (text: string) => {
        'worklet'
        runUpdate(text)
      },
    }
    const {doDependenciesDiffer} = useHandler(handlers, [runUpdate])

    const textInputHandler = useEvent(
      (event: {text: string}) => {
        'worklet'
        const {onSync} = handlers
        if (onSync) {
          onSync(event.text)
        }
      },
      ['onChange'],
      doDependenciesDiffer
    )

    const onSelectionChange = React.useCallback(
      (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        setSelection(e.nativeEvent.selection)
        _onSelectionChange?.(e)
      },
      [_onSelectionChange]
    )

    const onFocusHandler = React.useCallback(
      (e: any) => {
        focusedRef.current = true
        onFocus?.(e)
      },
      [onFocus]
    )
    const onBlurHandler = React.useCallback(
      (e: any) => {
        focusedRef.current = false
        onBlur?.(e)
      },
      [onBlur]
    )

    React.useImperativeHandle(ref, () => {
      return {
        blur: () => {
          dispatchCommand(animatedRef, 'blur', [])
        },
        clear: () => {
          updateFromWorklet('')
          setAutoFocus(true)
          dispatchCommand(animatedRef, 'setTextAndSelection', [0, '', -1, -1])
        },
        focus: () => {
          dispatchCommand(animatedRef, 'focus', [])
        },
        getSelection: () => {
          return selection
        },
        isFocused: () => focusedRef.current,
        transformText: (fn: (textInfo: TextInfo) => TextInfo, reflectChange: boolean): void => {
          const ti = fn({selection, text: value})
          if (!reflectChange) {
            return
          }
          updateFromWorklet(ti.text)
          setSelection(ti.selection)
          dispatchCommand(animatedRef, 'setTextAndSelection', [
            0,
            ti.text,
            ti.selection?.start ?? -1,
            ti.selection?.end ?? -1,
          ])
        },
        get value() {
          return value
        },
      }
    }, [animatedRef, selection, updateFromWorklet, value])

    const style = React.useMemo(() => {
      let textStyle = getTextStyle(textType, isDarkMode)
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

    const onPasteImageImpl = React.useCallback(
      (uris: Array<string>) => {
        if (onPasteImage) {
          onPasteImage(uris)
        }
      },
      [onPasteImage]
    )

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
      <AnimatedTextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        blurOnSubmit={false}
        multiline={multiline}
        onBlur={onBlurHandler}
        onChange={textInputHandler}
        onFocus={onFocusHandler}
        onSelectionChange={onSelectionChange}
        placeholder={placeholder}
        readOnly={disabled}
        ref={animatedRef}
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
      textAlignVertical: 'top',
    },
  }),
  singleline: {padding: 0},
}))
