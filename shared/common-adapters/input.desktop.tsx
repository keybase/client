// import * as React from 'react'
// import * as Styles from '@/styles'
// import Box from './box'
// import Text, {getStyle as getTextStyle} from './text.desktop'
//
// import type {Props, Selection, TextInfo, InputRef} from './input'
// import {checkTextInfo} from './input.shared'
//
// const Input = React.forwardRef<InputRef, Props>((p, ref) => {
//   return null
//   const {selectTextOnFocus, uncontrolled, onChangeText, autoFocus, value, clearTextCounter} = p
//   const inputRef = React.useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
//   const [focused, setFocused] = React.useState(false)
//
//   const select = React.useCallback(() => {
//     inputRef.current?.select()
//   }, [])
//   const focus = React.useCallback(() => {
//     inputRef.current?.focus()
//     selectTextOnFocus && select()
//   }, [selectTextOnFocus, select])
//
//   const _getValue = React.useCallback(() => {
//     return (uncontrolled ? inputRef.current?.value : p.value) || ''
//   }, [uncontrolled, p.value])
//
//   const selection = React.useCallback((): Selection => {
//     const n = inputRef.current
//     if (!n) {
//       return {end: 0, start: 0}
//     }
//     const {selectionStart, selectionEnd} = n
//     return {end: selectionEnd, start: selectionStart}
//   }, [])
//
//   const _autoResize = React.useCallback(() => {
//     if (!p.multiline) {
//       return
//     }
//
//     const n = inputRef.current
//     if (!n?.style) {
//       return
//     }
//
//     const value = _getValue()
//
//     // Try and not style/render thrash. We bookkeep the length of the string that was used to go up a line and if we shorten our length
//     // we'll remeasure. It's very expensive to just remeasure as the user is typing. it causes a lot of actual layout thrashing
//     if (p.smartAutoresize) {
//       const rect = n.getBoundingClientRect()
//       // width changed so throw out our data
//       if (rect.width !== _smartAutoresizeRef.current.width) {
//         _smartAutoresizeRef.current.width = rect.width
//         _smartAutoresizeRef.current.pivotLength = -1
//       }
//
//       // See if we've gone up in size, if so keep track of the input at that point
//       if (n.scrollHeight > rect.height) {
//         _smartAutoresizeRef.current.pivotLength = value.length
//         n.style.height = `${n.scrollHeight}px`
//       } else if (
//         // see if we went back down in height
//         _smartAutoresizeRef.current.pivotLength !== -1 &&
//         value.length <= _smartAutoresizeRef.current.pivotLength
//       ) {
//         _smartAutoresizeRef.current.pivotLength = -1
//         n.style.height = '1px'
//         n.style.height = `${n.scrollHeight}px`
//       }
//     } else {
//       n.style.height = '1px'
//       n.style.height = `${n.scrollHeight}px`
//     }
//   }, [_getValue, p.multiline, p.smartAutoresize])
//
//   const _onChangeText = React.useCallback(
//     (text: string) => {
//       _autoResize()
//       onChangeText?.(text)
//     },
//     [_autoResize, onChangeText]
//   )
//
//   const _transformText = React.useCallback(
//     (fn: (textInfo: TextInfo) => TextInfo, reflectChange?: boolean) => {
//       const n = inputRef.current
//       if (n) {
//         const textInfo: TextInfo = {
//           selection: {
//             end: n.selectionEnd,
//             start: n.selectionStart,
//           },
//           text: n.value,
//         }
//         const newTextInfo = fn(textInfo)
//         checkTextInfo(newTextInfo)
//         n.value = newTextInfo.text
//         n.selectionStart = newTextInfo.selection.start
//         n.selectionEnd = newTextInfo.selection.end
//
//         if (reflectChange) {
//           _onChangeText(newTextInfo.text)
//         }
//
//         _autoResize()
//       }
//     },
//     [_autoResize, _onChangeText]
//   )
//
//   const transformText = React.useCallback(
//     (fn: (textInfo: TextInfo) => TextInfo, reflectChange?: boolean) => {
//       if (!uncontrolled) {
//         throw new Error('transformText can only be called on uncontrolled components')
//       }
//
//       _transformText(fn, reflectChange)
//     },
//     [_transformText, uncontrolled]
//   )
//
//   React.useImperativeHandle(
//     ref,
//     () => ({
//       blur: () => {
//         inputRef.current?.blur()
//       },
//       focus,
//       getValue: () => {
//         if (uncontrolled) {
//           return _getValue()
//         } else {
//           throw new Error('getValue only supported on uncontrolled inputs')
//         }
//       },
//       select,
//       selection,
//       transformText,
//     }),
//     [focus, select, _getValue, uncontrolled, selection, transformText]
//   )
//
//   const _onFocus = () => {
//     setFocused(true)
//     p.onFocus?.()
//     p.selectTextOnFocus && select()
//   }
//
//   const _onBlur = () => {
//     setFocused(false)
//     p.onBlur?.()
//   }
//
//   const _smartAutoresizeRef = React.useRef({
//     pivotLength: -1,
//     width: -1,
//   })
//
//   const _onChange = (event: {target: {value?: string}}) => {
//     _onChangeText(event.target.value || '')
//   }
//
//   const _isComposingIME = React.useRef(false)
//
//   const _onCompositionStart = () => {
//     _isComposingIME.current = true
//   }
//
//   const _onCompositionEnd = () => {
//     _isComposingIME.current = false
//   }
//
//   const _onKeyUp = (e: React.KeyboardEvent) => {
//     if (_isComposingIME.current) {
//       return
//     }
//     p.onKeyUp?.(e)
//   }
//
//   const _onKeyDown = (e: React.KeyboardEvent) => {
//     if (_isComposingIME.current) {
//       return
//     }
//     p.onKeyDown?.(e)
//     if (p.onEnterKeyDown && e.key === 'Enter' && !e.shiftKey) {
//       if (e.altKey || e.ctrlKey) {
//         // If multiline, inject a newline.
//         if (p.multiline) {
//           _transformText(({text, selection}) => {
//             const newText = text.slice(0, selection.start || 0) + '\n' + text.slice(selection.end || 0)
//             const pos = (selection.start || 0) + 1
//             const newSelection = {end: pos, start: pos}
//             return {
//               selection: newSelection,
//               text: newText,
//             }
//           })
//         }
//       } else {
//         p.onEnterKeyDown(e)
//       }
//     }
//   }
//
//   const autoSizeOnceRef = React.useRef(false)
//   React.useEffect(() => {
//     if (!autoSizeOnceRef.current) {
//       autoSizeOnceRef.current = true
//       _autoResize()
//       autoFocus && focus()
//     }
//   }, [_autoResize, autoFocus, focus])
//
//   const lastValueRef = React.useRef(value)
//   React.useEffect(() => {
//     if (!uncontrolled && value !== lastValueRef.current) {
//       _autoResize()
//     }
//     lastValueRef.current = value
//   }, [uncontrolled, value, _autoResize])
//
//   const lastClearTextCounterRef = React.useRef(clearTextCounter)
//   React.useEffect(() => {
//     if (lastClearTextCounterRef.current !== clearTextCounter) {
//       if (!uncontrolled) {
//         throw new Error('clearTextCounter only works on uncontrolled components')
//       }
//
//       transformText(() => ({
//         selection: {end: 0, start: 0},
//         text: '',
//       }))
//     }
//     lastClearTextCounterRef.current = clearTextCounter
//   }, [clearTextCounter, uncontrolled, transformText])
//
//   const _rowsToHeight = (rows: number) => {
//     return rows * _lineHeight + 1 // border
//   }
//   const underlineColor = (() => {
//     if (p.hideUnderline) {
//       return Styles.globalColors.transparent
//     }
//
//     if (p.errorText?.length) {
//       return Styles.globalColors.red
//     }
//
//     return focused ? Styles.globalColors.blue : Styles.globalColors.black_10
//   })()
//
//   const defaultRowsToShow = Math.min(2, p.rowsMax || 2)
//   const containerStyle = (() => {
//     return p.small
//       ? ({
//           ...Styles.globalStyles.flexBoxRow,
//           width: '100%',
//         } as const)
//       : ({
//           ...Styles.globalStyles.flexBoxColumn,
//           alignItems: 'center',
//           marginBottom: Styles.globalMargins.small,
//           marginTop: Styles.globalMargins.small,
//         } as const)
//   })()
//
//   const inputStyle = Styles.collapseStyles([
//     styles.commonInput,
//     p.small ? styles.commonInputSmall : styles.commonInputRegular,
//     Styles.platformStyles({
//       isElectron: {
//         borderBottom: `1px solid ${underlineColor}`,
//         height: p.small ? 18 : 28,
//         maxWidth: 460,
//       },
//     }),
//   ])
//
//   const textareaStyle = Styles.collapseStyles([
//     styles.commonInput,
//     p.small
//       ? styles.commonInputSmall
//       : Styles.platformStyles({
//           isElectron: {...styles.commonInputRegular, borderBottom: `1px solid ${underlineColor}`},
//         }),
//     Styles.platformStyles({
//       isElectron: {
//         height: 'initial',
//         minHeight: _rowsToHeight(p.rowsMin || defaultRowsToShow),
//         paddingBottom: 0,
//         paddingTop: 0,
//         resize: 'none',
//         width: '100%',
//         wrap: 'off',
//         ...(p.rowsMax ? {maxHeight: _rowsToHeight(p.rowsMax)} : {overflowY: 'hidden'}),
//       },
//     }),
//   ])
//
//   const v = _getValue()
//
//   const floatingHintText =
//     !!v.length &&
//     (Object.hasOwn(p, 'floatingHintTextOverride') ? p.floatingHintTextOverride : p.hintText || ' ')
//
//   const commonProps = {
//     autoFocus: p.autoFocus,
//     className: p.className,
//     onBlur: _onBlur,
//     onChange: _onChange,
//     onClick: p.onClick,
//     onCompositionEnd: _onCompositionEnd,
//     onCompositionStart: _onCompositionStart,
//     onFocus: _onFocus,
//     onKeyDown: _onKeyDown,
//     onKeyUp: _onKeyUp,
//     placeholder: p.hintText,
//     readOnly: Object.hasOwn(p, 'editable') && !p.editable ? true : undefined,
//     ref: inputRef as any,
//     ...(p.maxLength ? {maxLength: p.maxLength} : null),
//     ...(p.uncontrolled ? null : {value: v}),
//   }
//
//   const _propTypeToSingleLineType = (() => {
//     switch (p.type) {
//       case 'password':
//         return 'password'
//       default:
//         return 'text'
//     }
//   })()
//
//   const singlelineProps = {
//     ...commonProps,
//     style: Styles.collapseStyles([inputStyle, p.inputStyle]) as React.CSSProperties,
//     type: _propTypeToSingleLineType,
//   }
//
//   const multilineProps = {
//     ...commonProps,
//     rows: p.rowsMin || defaultRowsToShow,
//     style: Styles.collapseStyles([textareaStyle, p.inputStyle]) as React.CSSProperties,
//   }
//
//   return (
//     <Box style={Styles.collapseStyles([containerStyle, p.style])}>
//       {!p.small && !p.hideLabel && (
//         <Text center={true} type="BodySmallSemibold" style={styles.floating}>
//           {floatingHintText}
//         </Text>
//       )}
//       {!!p.small && !!p.smallLabel && !p.hideLabel && (
//         <Text type="BodySmall" style={Styles.collapseStyles([styles.smallLabel, p.smallLabelStyle])}>
//           {p.smallLabel}
//         </Text>
//       )}
//       {p.multiline ? <textarea {...multilineProps} /> : <input {...singlelineProps} />}
//       {!!p.errorTextComponent && p.errorTextComponent}
//       {!!p.errorText && !p.small && (
//         <Text center={true} type="BodySmallError" style={Styles.collapseStyles([styles.error, p.errorStyle])}>
//           {p.errorText}
//         </Text>
//       )}
//     </Box>
//   )
// })
//
// const _lineHeight = 20
// const _headerTextStyle = getTextStyle('Header')
// const _bodyTextStyle = getTextStyle('Body')
// const _bodySmallTextStyle = getTextStyle('BodySmall')
//
// const styles = Styles.styleSheetCreate(() => ({
//   commonInput: Styles.platformStyles({
//     isElectron: {
//       ...Styles.globalStyles.fontSemibold,
//       backgroundColor: Styles.globalColors.transparent,
//       border: 'none',
//       color: Styles.globalColors.black,
//       flex: 1,
//       outlineWidth: 0,
//     },
//   }),
//   commonInputRegular: {
//     fontSize: _headerTextStyle.fontSize,
//     fontWeight: _headerTextStyle.fontWeight,
//     lineHeight: _headerTextStyle.lineHeight,
//     minWidth: 333,
//     textAlign: 'center',
//   },
//   commonInputSmall: {
//     fontSize: _bodyTextStyle.fontSize,
//     fontWeight: _bodyTextStyle.fontWeight,
//     lineHeight: _bodyTextStyle.lineHeight,
//     textAlign: 'left',
//   },
//   error: {
//     marginTop: Styles.globalMargins.xtiny,
//     width: '100%',
//   },
//   floating: Styles.platformStyles({
//     isElectron: {
//       color: Styles.globalColors.blueDark,
//       display: 'block',
//       minHeight: _bodySmallTextStyle.lineHeight,
//     },
//   }),
//   smallLabel: Styles.platformStyles({
//     isElectron: {
//       ...Styles.globalStyles.fontSemibold,
//       color: Styles.globalColors.blueDark,
//       fontSize: _bodySmallTextStyle.fontSize,
//       lineHeight: `${_lineHeight}px`,
//       marginRight: 8,
//     },
//   }),
// }))
// export default Input
