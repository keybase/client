// @flow
import React, {Component} from 'react'
// TODO remove this from this component, hook it in externally so we don't have these types of dependencies in storybook
import openURL from '../util/open-url'
import {defaultColor, fontSizeToSizeStyle, lineClamp, metaData} from './text.meta.desktop'
import {findDOMNode} from 'react-dom'
import {glamorous, desktopStyles} from '../styles'
import shallowEqual from 'shallowequal'

export type Background =
  | 'Announcements'
  | 'Documentation'
  | 'HighRisk'
  | 'Information'
  | 'Normal'
  | 'Success'
  | 'Terminal'

export type TextType =
  | 'Body'
  | 'BodyBig'
  | 'BodyBigLink'
  | 'BodyError'
  | 'BodyExtrabold'
  | 'BodyPrimaryLink'
  | 'BodySecondaryLink'
  | 'BodySemibold'
  | 'BodySemiboldLink'
  | 'BodySemiboldItalic'
  | 'BodySmall'
  | 'BodySmallExtrabold'
  | 'BodySmallError'
  | 'BodySmallInlineLink'
  | 'BodySmallItalic'
  | 'BodySmallPrimaryLink'
  | 'BodySmallSecondaryLink'
  | 'BodySmallSecondaryLinkExtrabold'
  | 'BodySmallSemibold'
  | 'BodySmallSemiboldItalic'
  | 'BodySmallSemiboldInlineLink'
  | 'BodySmallSuccess'
  | 'BodySuccess'
  | 'Header'
  | 'HeaderExtrabold'
  | 'HeaderBig'
  | 'HeaderBigExtrabold'
  | 'HeaderLink'
  | 'Terminal'
  | 'TerminalComment'
  | 'TerminalEmpty'
  | 'TerminalInline'

type Props = {
  allowFontScaling?: boolean,
  allowHighlightText?: boolean, // if true, highlighttext through refs works
  backgroundMode?: Background,
  children?: React.Node,
  className?: string,
  lineClamp?: number,
  onClick?: ?(e: SyntheticEvent<>) => void | ?() => void,
  onClickURL?: ?string,
  onLongPress?: () => void,
  onPress?: void,
  plainText?: boolean,
  selectable?: boolean,
  style?: StylesCrossPlatform,
  title?: ?string,
  type: TextType,
  underline?: boolean,
}

type MetaType = {
  fontSize: number,
  colorForBackgroundMode: {[key: Background]: ?string},
  isLink?: true,
  styleOverride?: ?Object,
  isTerminal?: true,
}

class Text extends Component<Props> {
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
    const classNames = [props.className]
    if (props.underline) {
      classNames.push('underline')
    } else if (meta.isLink && props.backgroundMode === 'Normal') {
      classNames.push('hover-underline')
    }
    return classNames.join(' ') || undefined
  }

  _urlClick = () => {
    this.props.onClickURL && openURL(this.props.onClickURL)
  }

  render() {
    if (!this.props.type) {
      throw new Error('Missing type on Text')
    }
    const Span = glamorous.span(
      getStyle(
        this.props.type,
        this.props.backgroundMode,
        this.props.lineClamp,
        !!this.props.onClick,
        this.props.selectable
      ),
      this.props.style
    )

    return (
      <Span
        title={this.props.title}
        ref={this.props.allowHighlightText ? this._setRef : undefined}
        className={this._className(this.props)}
        onClick={this.props.onClick || (this.props.onClickURL && this._urlClick)}
      >
        {this.props.children}
      </Span>
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
  const sizeStyle = fontSizeToSizeStyle(meta.fontSize)
  const colorStyle = {color: meta.colorForBackgroundMode[backgroundMode] || defaultColor(backgroundMode)}
  const cursorStyle = meta.isLink ? {cursor: 'pointer'} : null
  const lineClampStyle = lineClampNum ? lineClamp(lineClampNum) : null
  const clickableStyle = clickable ? desktopStyles.clickable : null
  const selectableStyle = selectable
    ? {
        userSelect: 'text',
        cursor: 'text',
      }
    : null
  const textDecoration = meta.isLink && backgroundMode !== 'Normal' ? {textDecoration: 'underline'} : null

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

export {getStyle}

export default Text
export {Text as TextMixed}
