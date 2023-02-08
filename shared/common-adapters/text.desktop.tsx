import * as Styles from '../styles'
import * as React from 'react'
// TODO remove this from this component, hook it in externally so we don't have these types of dependencies in storybook
import openURL from '../util/open-url'
import {fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.desktop'
import shallowEqual from 'shallowequal'
import type {Props, TextType, _StylesTextCrossPlatform} from './text'
import KB2 from '../util/electron.desktop'
const {showContextMenu} = KB2.functions

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
      clickable: !!props.onClick,
      color_white_important: props.negative,
      underline: props.underline || (meta.isLink && props.negative),
      'underline-never': props.underlineNever,
      // eslint-disable-next-line sort-keys
      'hover-underline': meta.isLink && !props.negative,
      lineClamp1: props.lineClamp === 1,
      lineClamp2: props.lineClamp === 2,
      lineClamp3: props.lineClamp === 3,
      lineClamp4: props.lineClamp === 4,
      lineClamp5: props.lineClamp === 5,
      selectable: props.selectable,
      text_center: props.center,
      virtualText: props.virtualText,
    })
  }

  _urlClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (!this.props.onClickURL) {
      return
    }
    e.stopPropagation()
    openURL(this.props.onClickURL)
  }

  private onContextMenu = event => {
    const url = this.props.onClickURL
    if (!url) {
      return
    }
    event.stopPropagation()
    showContextMenu?.(url)
  }

  render() {
    if (!this.props.type) {
      throw new Error('Missing type on Text')
    }

    return (
      <span
        title={this.props.title || undefined}
        ref={this.props.allowHighlightText ? this._spanRef : null}
        className={this._className(this.props)}
        onClick={this.props.onClick || (this.props.onClickURL && this._urlClick) || undefined}
        onContextMenuCapture={this.props.onClickURL ? this.onContextMenu : undefined}
        style={Styles.collapseStyles([this.props.style])}
        data-virtual-text={this.props.virtualText ? this.props.children : undefined}
      >
        {this.props.virtualText ? null : this.props.children}
      </span>
    )
  }
}

// Only used by external components
function externalGetStyle(
  type: TextType,
  negative?: boolean,
  lineClampNum?: number | null,
  clickable?: boolean | null,
  selectable?: boolean | null
): _StylesTextCrossPlatform {
  const meta = metaData()[type]
  const sizeStyle = fontSizeToSizeStyle(meta.fontSize)
  // pipe positive color through because caller probably isn't using class
  const colorStyle = {color: meta.colorForBackground[negative ? 'negative' : 'positive']}
  const cursorStyle: any = meta.isLink ? {cursor: 'pointer'} : null
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
export {Text as TextMixed}
export {allTextTypes} from './text.shared'
