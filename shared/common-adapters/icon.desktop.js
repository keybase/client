// @flow
import * as shared from './icon.shared'
import React, {PureComponent} from 'react'
import {FontIcon} from 'material-ui'
import {globalStyles, globalColors} from '../styles'
import {iconMeta} from './icon.constants'
import {resolveImageAsURL} from '../desktop/resolve-root'

import type {Exact} from '../constants/types/more'
import type {Props} from './icon'

class Icon extends PureComponent<void, Exact<Props>, void> {
  render () {
    let color = shared.defaultColor(this.props.type)
    let hoverColor = shared.defaultHoverColor(this.props.type)
    let iconType = shared.typeToIconMapper(this.props.type)

    if (!iconType) {
      console.warn('Null iconType passed')
      return null
    }

    if (this.props.inheritColor) {
      color = 'inherit'
      hoverColor = 'inherit'
    } else {
      color = this.props.style && this.props.style.color || color || (this.props.opacity ? globalColors.lightGrey : globalColors.black_40)
      hoverColor = this.props.style && this.props.style.hoverColor || hoverColor || (this.props.opacity ? globalColors.black : globalColors.black_75)
    }

    const ext = shared.typeExtension(iconType)
    const isFontIcon = iconType.startsWith('iconfont-')
    const fontSizeHint = shared.fontSize(iconType)

    if (isFontIcon) {
      const cleanStyle = {
        fontFamily: 'kb',
        speak: 'none',
        fontStyle: 'normal',
        fontWeight: 'normal',
        fontVariant: 'normal',
        textTransform: 'none',
        lineHeight: 1,
        WebkitFontSmoothing: 'antialiased',
        ...this.props.style}
      // We have to blow these styles away else FontIcon gets confused and will overwrite what it calculates
      delete cleanStyle.color
      delete cleanStyle.hoverColor

      return <FontIcon
        title={this.props.hint}
        style={{...globalStyles.noSelect, ...styles.icon, ...fontSizeHint, ...cleanStyle, ...(this.props.onClick ? globalStyles.clickable : {})}}
        className={this.props.className || ''}
        color={color}
        hoverColor={this.props.onClick ? hoverColor : null}
        onMouseEnter={this.props.onMouseEnter}
        onMouseLeave={this.props.onMouseLeave}
        onClick={this.props.onClick}>{String.fromCharCode(iconMeta[iconType].charCode || 0)}</FontIcon>
    } else {
      return <img
        className={this.props.className}
        title={this.props.hint}
        style={{...globalStyles.noSelect, ...this.props.style, ...(this.props.onClick ? globalStyles.clickable : {})}}
        onClick={this.props.onClick}
        srcSet={imgPath(iconType, ext)} />
    }
  }
}

const imgName = (type, ext, mult) => `${resolveImageAsURL('icons', type)}${mult > 1 ? `@${mult}x` : ''}.${ext} ${mult}x`
const imgPath = (type, ext) => {
  if (ext === 'gif') {
    return `${resolveImageAsURL('icons', type)}.${ext}`
  } else {
    return [1, 2, 3].map(mult => imgName(type, ext, mult)).join(', ')
  }
}

export const styles = {
  icon: {
    fontSize: 16,
  },
}

export default Icon
