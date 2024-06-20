import * as React from 'react'
import * as Styles from '@/styles'
import type { Props, TextInfo, RefType } from './input2'
import { getStyle as getTextStyle } from './text'

const maybeParseInt = (input: string | number, radix: number): number =>
    typeof input === 'string' ? parseInt(input, radix) : input

export const Input2 = React.memo(
    React.forwardRef<RefType, Props>(function Input2(p, ref) {
        const { style: _style, onChangeText: _onChangeText, multiline } = p
        const { textType = 'Body', rowsMax, rowsMin, padding, placeholder, onKeyUp: _onKeyUp } = p
        const { allowKeyboardEvents, className, disabled, autoFocus, onKeyDown: _onKeyDown, onEnterKeyDown } = p

        const [value, setValue] = React.useState('')
        // this isn't a value react can set on the input, so we need to drive it manually
        const selectionRef = React.useRef({ end: 0, start: 0 })
        const inputSingleRef = React.useRef<HTMLInputElement>(null)
        const inputMultiRef = React.useRef<HTMLTextAreaElement>(null)

        const autoResizeLastRef = React.useRef('')
        const autoResize = React.useCallback(() => {
            if (!multiline) {
                // no resizing height on single-line inputs
                return
            }

            // Allow textarea to layout automatically
            // if (this.props.growAndScroll) {
            //   return
            // }

            const n = inputMultiRef.current
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
        }, [multiline])

        const onChange = React.useCallback(
            (e: { target: any }) => {
                const s = e.target.value
                setValue(s)
                _onChangeText?.(s)
                autoResize()
            },
            [_onChangeText, autoResize]
        )
        const onSelect = React.useCallback((e: React.BaseSyntheticEvent<HTMLInputElement, HTMLInputElement>) => {
            selectionRef.current = { end: e.currentTarget.selectionEnd || 0, start: e.currentTarget.selectionStart || 0 }
        }, [])

        React.useImperativeHandle(ref, () => {
            const i = multiline ? inputMultiRef.current : inputSingleRef.current
            return {
                blur: () => {
                    i?.blur()
                },
                clear: () => {
                    if (i) {
                        i.value = ''
                    }
                },
                focus: () => {
                    i?.focus()
                },
                getBoundingClientRect: () => {
                    return i?.getBoundingClientRect()
                },
                getSelection: () => {
                    return selectionRef.current
                },
                isFocused: () => !!i && document.activeElement === i,
                transformText: (fn: (textInfo: TextInfo) => TextInfo, reflectChange: boolean): void => {
                    const ti = fn({ selection: selectionRef.current, text: value })
                    // defer since we can do this in other renders
                    setTimeout(() => {
                        setValue(ti.text)
                        selectionRef.current = { end: ti.selection?.end ?? 0, start: ti.selection?.start ?? 0 }
                        // defer this else we'll get onSelect called and wipe it out
                        setTimeout(() => {
                            if (i && ti.selection) {
                                if (typeof ti.selection.start === 'number') {
                                    i.selectionStart = ti.selection.start
                                }
                                if (typeof ti.selection.end === 'number') {
                                    i.selectionEnd = ti.selection.end
                                }
                            }
                        }, 10)
                        autoResize()
                        if (reflectChange) {
                            setTimeout(() => {
                                if (!i) return
                                onChange({ target: i })
                            }, 100)
                        }
                    }, 0)
                },
                value,
            }
        }, [value, multiline, autoResize, onChange])

        const rows = multiline ? rowsMin || Math.min(2, rowsMax || 2) : 0
        const style = React.useMemo(() => {
            const textStyle = getTextStyle(textType)
            if (multiline) {
                const heightStyles: { minHeight: number; maxHeight?: number; overflowY?: 'hidden' } = {
                    minHeight:
                        rows * (textStyle.lineHeight === undefined ? 20 : maybeParseInt(textStyle.lineHeight, 10) || 20) +
                        (padding ? Styles.globalMargins[padding] * 2 : 0),
                }

                if (rowsMax) {
                    heightStyles.maxHeight =
                        rowsMax *
                        (textStyle.lineHeight === undefined ? 20 : maybeParseInt(textStyle.lineHeight, 10) || 20)
                } else {
                    heightStyles.overflowY = 'hidden'
                }

                const paddingStyles = padding ? Styles.padding(Styles.globalMargins[padding]) : {}

                return Styles.collapseStyles([
                    styles.noChrome, // noChrome comes before because we want lineHeight set in multiline
                    textStyle,
                    styles.multiline,
                    heightStyles,
                    paddingStyles,
                    // this.props.resize && styles.resize,
                    // this.props.growAndScroll && styles.growAndScroll,
                    _style,
                ])
            } else {
                return Styles.collapseStyles([
                    textStyle as any,
                    styles.noChrome, // noChrome comes after to unset lineHeight in singleline
                    // this.props.flexable && styles.flexable,
                    _style,
                ])
            }
        }, [_style, multiline, textType, padding, rowsMax, rows])

        const isComposingIMERef = React.useRef(false)

        const onCompositionStart = () => {
            isComposingIMERef.current = true
        }

        const onCompositionEnd = () => {
            isComposingIMERef.current = false
        }

        const onKeyDown = React.useCallback(
            (e: React.KeyboardEvent) => {
                if (isComposingIMERef.current) {
                    return
                }
                _onKeyDown?.(e)
                if (onEnterKeyDown && e.key === 'Enter' && !(e.shiftKey || e.ctrlKey || e.altKey)) {
                    onEnterKeyDown(e)
                }
            },
            [_onKeyDown, onEnterKeyDown]
        )

        const onKeyUp = (e: React.KeyboardEvent) => {
            if (isComposingIMERef.current) {
                return
            }
            _onKeyUp?.(e)
        }

        const commonProps = {
            autoFocus,
            className: Styles.classNames({ mousetrap: allowKeyboardEvents ?? true }, className),
            onChange,
            onCompositionEnd,
            onCompositionStart,
            onKeyDown,
            onKeyUp,
            onSelect: onSelect as any,
            placeholder,
            value,
            ...(disabled ? { readOnly: true } : {}),
        }

        return multiline ? (
            <textarea {...commonProps} style={style as any} ref={inputMultiRef} rows={rows} />
        ) : (
            <input {...commonProps} ref={inputSingleRef} style={style as any} />
        )
    })
)

const styles = Styles.styleSheetCreate(() => ({
    flexable: {
        flex: 1,
        minWidth: 0,
        // "width: 0" is needed for the input to shrink in flex
        // https://stackoverflow.com/questions/42421361/input-button-elements-not-shrinking-in-a-flex-container
        width: 0,
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
        isElectron: { resize: 'vertical' },
    }),
}))
