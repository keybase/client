import * as Styles from '@/styles'
import * as React from 'react'
import openURL from '@/util/open-url'
import {fontSizeToSizeStyle, metaData} from './text.meta.desktop'
import type {Props, TextType, _StylesTextCrossPlatform, TextStyle} from './text'
import './text.css'
import KB2 from '@/util/electron.desktop'
const {showContextMenu} = KB2.functions

const Text = React.memo(function Text(p: Props) {
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
        const writeRef = textRef
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
    const isLink = metaData(true)[type].isLink
    return Styles.classNames(`text_${type}`, _className, {
      clickable: !!onClick,
      color_white_important: negative,
      underline: underline || (isLink && negative),
      'underline-never': underlineNever,
      // eslint-disable-next-line sort-keys
      'hover-underline': isLink && !negative,
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
export function getTextStyle(type: TextType, isDarkMode: boolean): TextStyle {
  const meta = metaData(isDarkMode)[type]
  const sizeStyle = fontSizeToSizeStyle(meta.fontSize)
  // pipe positive color through because caller probably isn't using class
  const colorStyle = {color: meta.colorForBackground['positive']}
  const cursorStyle = meta.isLink ? {cursor: 'pointer'} : null

  return Styles.platformStyles({
    common: {
      ...meta.styleOverride,
    },
    isElectron: {
      ...sizeStyle,
      ...colorStyle,
      ...cursorStyle,
    },
  })
}

export default Text
