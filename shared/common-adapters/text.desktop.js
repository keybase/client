// @flow
import * as Styles from '../styles'
import * as React from 'react'
// TODO remove this from this component, hook it in externally so we don't have these types of dependencies in storybook
import openURL from '../util/open-url'
import {defaultColor, lineClamp, metaData} from './text.meta.desktop'
import {findDOMNode} from 'react-dom'
import shallowEqual from 'shallowequal'

import type {Props, TextType, Background} from './text'

class Text extends React.Component<Props> {
  _span: any

  highlightText() {
    const el = findDOMNode(this._span)
    const range = document.createRange()
    // $FlowIssue
    range.selectNodeContents(el)

    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }

  _setRef = (ref: any) => {
    this._span = ref
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
    const meta = metaData[props.type]
    const classNames = [`text_${props.type}`, props.className]
    if (props.underline) {
      classNames.push('underline')
    } else if (meta.isLink && (!props.backgroundMode || props.backgroundMode === 'Normal')) {
      classNames.push('hover-underline')
    }
    return classNames.filter(Boolean).join(' ') || undefined
  }

  _urlClick = (e: MouseEvent) => {
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
      getStyle(
        this.props.type,
        this.props.backgroundMode,
        this.props.lineClamp,
        !!this.props.onClick,
        this.props.selectable
      ),
      this.props.style,
    ])

    return (
      <span
        title={this.props.title}
        ref={this.props.allowHighlightText ? this._setRef : undefined}
        className={this._className(this.props)}
        onClick={this.props.onClick || (this.props.onClickURL && this._urlClick)}
        style={style}
      >
        {this.props.children}
      </span>
    )
  }
}

function getStyle(
  type: TextType,
  backgroundMode?: Background = 'Normal',
  lineClampNum?: ?number,
  clickable?: ?boolean,
  selectable: ?boolean
) {
  const meta = metaData[type]
  const colorStyle =
    backgroundMode === 'Normal'
      ? null
      : {
          color:
            // $FlowIssue
            (meta.colorForBackgroundMode && meta.colorForBackgroundMode[backgroundMode]) ||
            defaultColor(backgroundMode),
        }
  const lineClampStyle = lineClampNum ? lineClamp(lineClampNum) : null
  const clickableStyle = clickable ? Styles.desktopStyles.clickable : null
  const selectableStyle = selectable
    ? {
        cursor: 'text',
        userSelect: 'text',
      }
    : null
  const textDecoration = meta.isLink && backgroundMode !== 'Normal' ? {textDecoration: 'underline'} : null

  return {
    ...colorStyle,
    ...lineClampStyle,
    ...clickableStyle,
    ...selectableStyle,
    ...textDecoration,
  }
}
export {getStyle}

export default Text
export {Text as TextMixed}
