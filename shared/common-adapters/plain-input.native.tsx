import * as React from 'react'
import * as Styles from '@/styles'
import ClickableBox from './clickable-box'
import logger from '@/logger'
import pick from 'lodash/pick'
import type {InternalProps, TextInfo, Selection} from './plain-input'
import {
  TextInput as NativeTextInput,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native'
import {Box2} from './box'
import {checkTextInfo} from './input.shared'
import {getStyle as getTextStyle} from './text'
import {isIOS} from '@/constants/platform'
import {stringToUint8Array} from 'uint8array-extras'

type PlainInputRef = {
  blur: () => void
  focus: () => void
  clear: () => void
  value: () => string
  isFocused: () => boolean
  transformText: (fn: (textInfo: TextInfo) => TextInfo, reflectChange?: boolean) => void
  getSelection: () => {
    end: number | null
    start: number | null
  } | null
  setSelection: (s: Selection) => void
}

const PlainInput = React.memo(
  React.forwardRef<PlainInputRef, InternalProps>((p, ref) => {
    const {dummyInput, onFocus, value, maxBytes, onChangeText, onSelectionChange} = p
    const {onPasteImage, onEnterKeyDown} = p

    const inputRef = React.useRef<NativeTextInput>(null)

    const lastNativeTextRef = React.useRef<string | undefined>()
    const lastNativeSelectionRef = React.useRef<Selection | undefined>()

    // This is controlled if a value prop is passed
    const controlled = typeof value === 'string'

    // Needed to support wrapping with e.g. a ClickableBox. See
    // https://facebook.github.io/react-native/docs/direct-manipulation.html .
    const setNativeProps = React.useCallback((nativeProps: object) => {
      inputRef.current?.setNativeProps(nativeProps)
    }, [])

    const _setSelection = React.useCallback(
      (selection: Selection) => {
        const newSelection = _sanityCheckSelection(selection, lastNativeTextRef.current || '')
        setNativeProps({selection: newSelection})
        lastNativeSelectionRef.current = selection
      },
      [setNativeProps]
    )

    const _onChangeText = React.useCallback(
      (t: string) => {
        if (maxBytes) {
          if (stringToUint8Array(t).byteLength > maxBytes) {
            return
          }
        }
        lastNativeTextRef.current = t
        onChangeText?.(t)

        // call if it hasn't been called already
        afterTransformRef.current?.()
      },
      [maxBytes, onChangeText]
    )

    const transformText = React.useCallback(
      (fn: (textInfo: TextInfo) => TextInfo, reflectChange?: boolean) => {
        if (controlled) {
          const errMsg =
            'Attempted to use transformText on controlled input component. Use props.value and setSelection instead.'
          logger.error(errMsg)
          throw new Error(errMsg)
        }
        const currentTextInfo = {
          selection: lastNativeSelectionRef.current || {end: 0, start: 0},
          text: lastNativeTextRef.current || '',
        }
        const newTextInfo = fn(currentTextInfo)
        const newCheckedSelection = _sanityCheckSelection(newTextInfo.selection, newTextInfo.text)
        checkTextInfo(newTextInfo)

        // this is a very hacky workaround for internal bugs in RN TextInput
        // write a stub with different content

        afterTransformRef.current = () => {
          afterTransformRef.current = undefined
          setNativeProps({text: newTextInfo.text})
          setTimeout(() => {
            setNativeProps({selection: newCheckedSelection})
          }, 20)
          if (reflectChange) {
            _onChangeText(newTextInfo.text)
          }
        }

        // call if it hasn't been called already
        setTimeout(() => {
          afterTransformRef.current?.()
        }, 20)
      },
      [_onChangeText, controlled, setNativeProps]
    )

    React.useImperativeHandle(ref, () => {
      // TODO
      //
      return {
        blur: () => {
          inputRef.current?.blur()
        },
        clear: () => {
          inputRef.current?.clear()
        },
        focus: () => {
          if (dummyInput) {
            onFocus?.()
          } else {
            inputRef.current?.focus()
          }
        },
        getSelection: () => {
          return lastNativeSelectionRef.current || {end: 0, start: 0}
        },
        isFocused: () => {
          return !!inputRef.current?.isFocused()
        },
        setSelection: s => {
          if (!controlled) {
            const errMsg =
              'Attempted to use setSelection on uncontrolled input component. Use transformText instead'
            logger.error(errMsg)
            throw new Error(errMsg)
          }
          _setSelection(s)
        },
        transformText,
        value: () => {
          return lastNativeTextRef.current ?? ''
        },
      }
    }, [dummyInput, onFocus, _setSelection, controlled, transformText])

    const afterTransformRef = React.useRef<(() => void) | undefined>()

    // Validate that this selection makes sense with current value
    const _sanityCheckSelection = (selection: Selection, nativeText: string): Selection => {
      let {start, end} = selection
      end = Math.max(0, Math.min(end || 0, nativeText.length))
      start = Math.min(start || 0, end)
      return {end, start}
    }

    const _onSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const {start, end} = event.nativeEvent.selection
      lastNativeSelectionRef.current = {end, start}
      onSelectionChange?.(lastNativeSelectionRef.current)
    }

    const onImageChange = (e: NativeSyntheticEvent<{uri: string; linkUri: string}>) => {
      if (onPasteImage) {
        const {uri, linkUri} = e.nativeEvent
        uri && onPasteImage([linkUri || uri])
      }
    }

    const _onSubmitEditing = React.useCallback(() => {
      onEnterKeyDown?.()
    }, [onEnterKeyDown])

    const _getProps = () => {
      const _getStyle = () => {
        const _getCommonStyle = () => {
          const textStyle = getTextStyle(p.textType ?? 'Body')
          // RN TextInput plays better without this
          if (isIOS) {
            delete textStyle.lineHeight
          }
          return Styles.collapseStyles([styles.common, textStyle as any])
        }

        const _getMultilineStyle = () => {
          const defaultRowsToShow = Math.min(2, p.rowsMax || 2)
          const lineHeight = getTextStyle(p.textType ?? 'Body').lineHeight
          const paddingStyles = p.padding ? Styles.padding(Styles.globalMargins[p.padding]) : {}
          return Styles.collapseStyles([
            styles.multiline,
            {
              minHeight: (p.rowsMin || defaultRowsToShow) * (lineHeight ?? 0),
            },
            !!p.rowsMax && {maxHeight: p.rowsMax * (lineHeight ?? 0)},
            paddingStyles,
          ])
        }

        const _getSinglelineStyle = () => {
          const lineHeight = getTextStyle(p.textType ?? 'Body').lineHeight
          return Styles.collapseStyles([styles.singleline, {maxHeight: lineHeight, minHeight: lineHeight}])
        }

        return Styles.collapseStyles([
          _getCommonStyle(),
          p.multiline ? _getMultilineStyle() : _getSinglelineStyle(),
          p.style,
        ])
      }
      const common = {
        ...pick(p, ['maxLength', 'value']), // Props we should only passthrough if supplied
        allowFontScaling: p.allowFontScaling,
        autoCapitalize: p.autoCapitalize || 'none',
        autoCorrect: !!p.autoCorrect,
        autoFocus: p.autoFocus,
        children: p.children,
        editable: !p.disabled,
        keyboardType: p.keyboardType ?? 'default',
        multiline: false,
        onBlur: p.onBlur,
        onChangeText: _onChangeText,
        onEndEditing: p.onEndEditing,
        onFocus: p.onFocus,
        onImageChange,
        onKeyPress: p.onKeyPress,
        onSelectionChange: _onSelectionChange,
        onSubmitEditing: _onSubmitEditing,
        placeholder: p.placeholder,
        placeholderTextColor: Styles.globalColors.black_35,
        ref: inputRef,
        returnKeyType: p.returnKeyType,
        secureTextEntry: p.type === 'password' || p.secureTextEntry,
        // currently broken on ios https://github.com/facebook/react-native/issues/30585
        selectTextOnFocus: p.selectTextOnFocus,
        style: _getStyle(),
        textContentType: p.textContentType,
        underlineColorAndroid: 'transparent',
      } as const

      if (p.multiline) {
        return {
          ...common,
          blurOnSubmit: false,
          multiline: true,
        }
      }
      return common
    }

    const props = _getProps()

    if (props.value) {
      lastNativeTextRef.current = props.value
    }
    if (p.dummyInput) {
      // There are three things we want from a dummy input.
      // 1. Tapping the input does not fire the native handler. Because the native handler opens the keyboard which we don't want.
      // 2. Calls to ref.focus() on the input do not fire the native handler.
      // 3. Visual feedback is seen when tapping the input.
      // editable=false yields 1 and 2
      // pointerEvents=none yields 1 and 3
      return (
        <ClickableBox style={{flexGrow: 1}} onClick={props.onFocus}>
          <Box2 direction="horizontal" pointerEvents="none">
            <NativeTextInput
              {...props}
              editable={false}
              // needed to workaround changing this not doing the right thing
              key={p.type}
            />
          </Box2>
        </ClickableBox>
      )
    }
    return <NativeTextInput {...props} />
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

export default PlainInput
