import * as Styles from '../styles'
import * as React from 'react'
// TODO remove this from this component, hook it in externally so we don't have these types of dependencies in storybook
import openURL from '../util/open-url'
import {fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.desktop'
import shallowEqual from 'shallowequal'

import {Props, TextType} from './text'

class Text extends React.Component<Props> {
  _spanRef = React.createRef<HTMLSpanElement>()

  highlightText() {
    const el = this._spanRef.current
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
  }

  shouldComponentUpdate(nextProps: Props): boolean {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (key === 'style') {
        return shallowEqual(obj, oth)
      } else if (key === 'children' && this.props.plainText && nextProps.plainText) {
        // child will be plain text
        return shallowEqual(obj, oth)
      }
      return undefined
    })
  }

  _className(props: Props) {
    const meta = metaData()[props.type]
    return Styles.classNames(`text_${props.type}`, props.className, {
      underline: props.underline,
      // eslint-disable-next-line sort-keys
      'hover-underline': meta.isLink && !props.negative,
      text_center: props.center,
    })
  }

  _urlClick = (e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {
    if (!this.props.onClickURL) {
      return
    }
    e.stopPropagation()
    openURL(this.props.onClickURL)
  }

  render() {
    if (!this.props.type) {
      throw new Error('Missing type on Text')
    }

    const style = Styles.collapseStyles([
      fastGetStyle(
        this.props.type,
        this.props.selectable || null,
        this.props.negative,
        this.props.lineClamp,
        !!this.props.onClick
      ),
      this.props.style,
    ])

    return (
      <span
        title={this.props.title || undefined}
        ref={this.props.allowHighlightText ? this._spanRef : null}
        className={this._className(this.props)}
        onClick={this.props.onClick || (this.props.onClickURL && this._urlClick) || undefined}
        style={style}
      >
        {this.props.children}
      </span>
    )
  }
}

// Only used by this file, other things (input etc) refer to this. TODO likely discuss and change how this works
function fastGetStyle(
  type: TextType,
  selectable: boolean | null,
  negative?: boolean,
  lineClampNum?: number | null,
  clickable?: boolean | null
) {
  const meta = metaData()[type]
  // positive color is in css
  const colorStyle = negative ? {color: Styles.globalColors.white} : null
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
    ...colorStyle,
    ...lineClampStyle,
    ...clickableStyle,
    ...selectableStyle,
    ...textDecoration,
  }
}

// Only used by external components
function externalGetStyle(
  type: TextType,
  negative?: boolean,
  lineClampNum?: number | null,
  clickable?: boolean | null,
  selectable?: boolean | null
) {
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
  }
}
export {externalGetStyle as getStyle}

export default Text
export {Text as TextMixed}
export {allTextTypes} from './text.shared'
