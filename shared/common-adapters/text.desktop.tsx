import * as Styles from '@/styles'
import * as React from 'react'
import openURL from '@/util/open-url'
import {fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.desktop'
import type {Props, TextType, _StylesTextCrossPlatform} from './text'
import KB2 from '@/util/electron.desktop'
const {showContextMenu} = KB2.functions

const Text = React.memo((p: Props) => {
  const {onClickURL, allowHighlightText, textRef, className: _className} = p
  const {type, onClick, negative, underlineNever, lineClamp, selectable} = p
  const {center, tooltip, virtualText, underline, title, style, children} = p
  const spanRef = React.useRef<HTMLSpanElement | null>(null)

  const highlightText = React.useCallback(() => {
    const el = spanRef.current
    if (!el) {
      return
    }
    const range = document.createRange()
    range.selectNodeContents(el)

    const sel = window.getSelection()
    if (sel) {
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [])

  const setRef = React.useCallback(
    (r: HTMLSpanElement | null) => {
      if (allowHighlightText) {
        spanRef.current = r
      }

      if (textRef) {
        // outer type isn't writable due to class components
        const writeRef = textRef as React.RefObject<typeof textRef.current>
        // eslint-disable-next-line
        writeRef.current = {
          divRef: {current: null},
          highlightText: () => {
            allowHighlightText && highlightText()
          },
          measure: () => {
            return r?.getBoundingClientRect()
          },
        }
      }
    },
    [allowHighlightText, highlightText, textRef]
  )

  const className = (() => {
    const meta = metaData()[type]
    return Styles.classNames(`text_${type}`, _className, {
      clickable: !!onClick,
      color_white_important: negative,
      underline: underline || (meta.isLink && negative),
      'underline-never': underlineNever,
      // eslint-disable-next-line sort-keys
      'hover-underline': meta.isLink && !negative,
      lineClamp1: lineClamp === 1,
      lineClamp2: lineClamp === 2,
      lineClamp3: lineClamp === 3,
      lineClamp4: lineClamp === 4,
      lineClamp5: lineClamp === 5,
      selectable: selectable,
      text_center: center,
      tooltip: tooltip,
      virtualText: virtualText,
    })
  })()

  const onContextMenu = React.useCallback(
    (event: React.SyntheticEvent<HTMLSpanElement>) => {
      const url = onClickURL
      if (!url) {
        return
      }
      event.stopPropagation()
      showContextMenu?.(url)
    },
    [onClickURL]
  )

  const urlClick = React.useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (!onClickURL) {
        return
      }
      e.stopPropagation()
      openURL(onClickURL)
    },
    [onClickURL]
  )

  return (
    <span
      title={title || undefined}
      ref={setRef}
      className={className}
      onClick={onClick || (onClickURL ? urlClick : undefined) || undefined}
      onContextMenuCapture={onClickURL ? onContextMenu : undefined}
      style={Styles.collapseStyles([style]) as React.CSSProperties}
      data-virtual-text={virtualText ? children : undefined}
      data-tooltip={tooltip}
    >
      {virtualText ? null : children}
    </span>
  )
})

// Only used by external components
function externalGetStyle(
  type: TextType,
  negative?: boolean,
  lineClampNum?: number,
  clickable?: boolean,
  selectable?: boolean
): _StylesTextCrossPlatform {
  const meta = metaData()[type]
  const sizeStyle = fontSizeToSizeStyle(meta.fontSize)
  // pipe positive color through because caller probably isn't using class
  const colorStyle = {color: meta.colorForBackground[negative ? 'negative' : 'positive']}
  const cursorStyle = meta.isLink ? {cursor: 'pointer'} : null
  const lineClampStyle = lineClampNum ? lineClamp(lineClampNum) : null
  const clickableStyle = clickable ? Styles.desktopStyles.clickable : null
  const selectableStyle = selectable
    ? {
        cursor: 'text',
        userSelect: 'text',
      }
    : null
  const textDecoration = meta.isLink && negative ? {textDecoration: 'underline'} : null

  return {
    ...sizeStyle,
    ...colorStyle,
    ...cursorStyle,
    ...lineClampStyle,
    ...clickableStyle,
    ...selectableStyle,
    ...textDecoration,
    ...meta.styleOverride,
  } as _StylesTextCrossPlatform
}
export {externalGetStyle as getStyle}

export default Text
