import * as React from 'react'
import * as Styles from '@/styles'
import {getStyle as getTextStyle} from './text.desktop'
import logger from '@/logger'
import {checkTextInfo} from './input.shared'
import type {InternalProps, TextInfo, Selection} from './plain-input'
import {stringToUint8Array} from 'uint8array-extras'

const maybeParseInt = (input: string | number, radix: number): number =>
  typeof input === 'string' ? parseInt(input, radix) : input

export type PlainInputRef = {
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

type NativeTextRef = {
  focus: () => void
  blur: () => void
  value: string
  style: {height: string}
  scrollHeight: number
  selectionStart: number | null
  selectionEnd: number | null
}

const PlainInput = React.memo(
  React.forwardRef<PlainInputRef, InternalProps>((p, ref) => {
    const {onKeyDown: _onKeyDown, onEnterKeyDown: _onEnterKeyDown, onKeyUp: _onKeyUp} = p
    const {growAndScroll, multiline, onFocus: _onFocus, selectTextOnFocus, onChangeText} = p
    const {maxBytes, globalCaptureKeypress, onBlur, onClick, style, resize, maxLength} = p
    const {rowsMin, rowsMax, textType, padding, flexable = true, type} = p
    const {autoFocus, allowKeyboardEvents, placeholder, spellCheck, disabled, value, className} = p
    const inputRef = React.useRef<NativeTextRef>(null)
    const isComposingIMERef = React.useRef(false)
    const mountedRef = React.useRef(true)
    const autoResizeLastRef = React.useRef('')

    const focus = React.useCallback(() => {
      inputRef.current?.focus()
    }, [])

    const onCompositionStart = React.useCallback(() => {
      isComposingIMERef.current = true
    }, [])

    const onCompositionEnd = React.useCallback(() => {
      isComposingIMERef.current = false
    }, [])

    const onKeyDown = React.useCallback(
      (e: React.KeyboardEvent) => {
        if (isComposingIMERef.current) {
          return
        }
        _onKeyDown?.(e)
        if (e.key === 'Enter' && !(e.shiftKey || e.ctrlKey || e.altKey)) {
          _onEnterKeyDown?.(e)
        }
      },
      [_onKeyDown, _onEnterKeyDown]
    )

    const onKeyUp = React.useCallback(
      (e: React.KeyboardEvent) => {
        if (isComposingIMERef.current) {
          return
        }
        _onKeyUp?.(e)
      },
      [_onKeyUp]
    )

    const autoResize = React.useCallback(() => {
      if (!multiline) {
        // no resizing height on single-line inputs
        return
      }

      // Allow textarea to layout automatically
      if (growAndScroll) {
        return
      }

      const n = inputRef.current
      if (!n) {
        return
      }

      // ignore if value hasn't changed
      if (n.value === autoResizeLastRef.current) {
        return
      }
      autoResizeLastRef.current = n.value

      n.style.height = '1px'
      n.style.height = `${n.scrollHeight}px`
    }, [multiline, growAndScroll])

    // This is controlled if a value prop is passed
    const isControlled = typeof p.value === 'string'

    const setSelection = React.useCallback(
      (s: Selection) => {
        if (!isControlled) {
          const errMsg =
            'Attempted to use setSelection on uncontrolled input component. Use transformText instead'
          logger.error(errMsg)
          throw new Error(errMsg)
        }
        const n = inputRef.current
        if (n) {
          n.selectionStart = s.start
          n.selectionEnd = s.end
        }
      },
      [isControlled]
    )

    const onFocus = React.useCallback(() => {
      _onFocus?.()
      selectTextOnFocus &&
        // doesn't work within the same tick
        setTimeout(
          () =>
            mountedRef.current &&
            setSelection({
              end: inputRef.current?.value.length || 0,
              start: 0,
            })
        )
    }, [_onFocus, selectTextOnFocus, setSelection])

    const onChange = React.useCallback(
      ({target: {value = ''}}) => {
        if (maxBytes) {
          if (stringToUint8Array(value).byteLength > maxBytes) {
            return
          }
        }

        onChangeText?.(value)
        autoResize()
      },
      [maxBytes, onChangeText, autoResize]
    )

    const globalKeyDownHandler = React.useCallback(
      (ev: KeyboardEvent) => {
        const target = ev.target
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          return
        }

        const isPasteKey = ev.key === 'v' && (ev.ctrlKey || ev.metaKey)
        const isValidSpecialKey = [
          'Backspace',
          'Delete',
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Enter',
        ].includes(ev.key)
        if (ev.type === 'keypress' || isPasteKey || isValidSpecialKey) {
          focus()
        }
      },
      [focus]
    )

    React.useEffect(() => {
      if (globalCaptureKeypress) {
        const body = document.body
        body.addEventListener('keydown', globalKeyDownHandler)
        body.addEventListener('keypress', globalKeyDownHandler)
        return () => {
          body.removeEventListener('keydown', globalKeyDownHandler)
          body.removeEventListener('keypress', globalKeyDownHandler)
        }
      }
      return () => {}
    }, [globalCaptureKeypress, globalKeyDownHandler])

    React.useEffect(() => {
      mountedRef.current = true
      return () => {
        mountedRef.current = false
      }
    }, [])

    const getCommonProps = () => {
      const commonProps = {
        autoFocus,
        className: Styles.classNames((allowKeyboardEvents ?? true) && 'mousetrap', className),
        maxLength,
        onBlur,
        onChange,
        onClick,
        onCompositionEnd,
        onCompositionStart,
        onFocus,
        onKeyDown,
        onKeyUp,
        placeholder,
        ref: inputRef,
        spellCheck,
        value,
        ...(maxLength ? {maxLength} : {}),
        ...(disabled ? {readOnly: true} : {}),
      }
      return commonProps
    }

    const getMultilineProps = () => {
      const rows = rowsMin || Math.min(2, rowsMax || 2)
      const textStyle = getTextStyle(textType ?? 'Body')
      const heightStyles: {minHeight: number; maxHeight?: number; overflowY?: 'hidden'} = {
        minHeight:
          rows * (textStyle.lineHeight === undefined ? 20 : maybeParseInt(textStyle.lineHeight, 10) || 20) +
          (padding ? Styles.globalMargins[padding] * 2 : 0),
      }
      if (rowsMax) {
        heightStyles.maxHeight =
          rowsMax * (textStyle.lineHeight === undefined ? 20 : maybeParseInt(textStyle.lineHeight, 10) || 20)
      } else {
        heightStyles.overflowY = 'hidden'
      }

      const paddingStyles = padding ? Styles.padding(Styles.globalMargins[padding]) : {}
      return {
        ...getCommonProps(),
        rows,
        style: Styles.collapseStyles([
          styles.noChrome, // noChrome comes before because we want lineHeight set in multiline
          textStyle,
          styles.multiline,
          heightStyles,
          paddingStyles,
          resize && styles.resize,
          growAndScroll && styles.growAndScroll,
          style,
        ]) as React.CSSProperties,
      }
    }

    const getSinglelineProps = () => {
      const textStyle = getTextStyle(textType ?? 'Body')
      return {
        ...getCommonProps(),
        style: Styles.collapseStyles([
          textStyle,
          styles.noChrome, // noChrome comes after to unset lineHeight in singleline
          flexable && styles.flexable,
          style,
        ]) as React.CSSProperties,
        type,
      }
    }

    const inputProps = multiline ? getMultilineProps() : getSinglelineProps()

    const transformText = React.useCallback(
      (fn: (textInfo: TextInfo) => TextInfo, reflectChange?: boolean) => {
        if (isControlled) {
          const errMsg =
            'Attempted to use transformText on controlled input component. Use props.value and setSelection instead.'
          logger.error(errMsg)
          throw new Error(errMsg)
        }
        const n = inputRef.current
        if (n) {
          const textInfo: TextInfo = {
            selection: {
              end: n.selectionEnd,
              start: n.selectionStart,
            },
            text: n.value,
          }
          const newTextInfo = fn(textInfo)
          checkTextInfo(newTextInfo)
          n.value = newTextInfo.text
          // if we change this immediately it can fail
          setTimeout(() => {
            n.selectionStart = newTextInfo.selection.start
            n.selectionEnd = newTextInfo.selection.end
          }, 1)

          if (reflectChange) {
            onChange({target: inputRef.current ?? {value: ''}})
          }

          autoResize()
        }
      },
      [autoResize, isControlled, onChange]
    )

    React.useImperativeHandle(ref, () => {
      return {
        blur: () => {
          inputRef.current?.blur()
        },
        clear: () => {
          if (inputRef.current) {
            inputRef.current.value = ''
          }
        },
        focus,
        getSelection: () => {
          const n = inputRef.current
          if (n) {
            return {end: n.selectionEnd, start: n.selectionStart}
          }
          return null
        },
        isFocused: () => {
          return !!inputRef.current && document.activeElement === (inputRef.current as Element)
        },
        setSelection,
        transformText,
        value: () => {
          return inputRef.current?.value ?? ''
        },
      }
    })

    const {ref: inputPropsRef, ...restInputProps} = inputProps
    return (
      <>
        {multiline ? (
          <textarea {...restInputProps} ref={inputPropsRef as unknown as React.RefObject<HTMLTextAreaElement>} />
        ) : (
          <input {...restInputProps} ref={inputPropsRef as unknown as React.RefObject<HTMLInputElement>} />
        )}
      </>
    )
  })
)

const styles = Styles.styleSheetCreate(() => ({
  flexable: {
    flex: 1,
    minWidth: 0,
    // "width" is needed for the input to work in flex
    // https://stackoverflow.com/questions/42421361/input-button-elements-not-shrinking-in-a-flex-container
    width: '100%',
  },
  growAndScroll: Styles.platformStyles({
    isElectron: {
      maxHeight: '100%',
      overflowY: 'scroll',
    },
  }),
  multiline: Styles.platformStyles({
    isElectron: {
      height: 'initial',
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
  resize: Styles.platformStyles({
    isElectron: {resize: 'vertical'},
  }),
}))

export default PlainInput
