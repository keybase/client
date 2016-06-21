/* @flow */

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'
import {FontIcon} from 'material-ui'
import type {Props} from './icon'
import {resolveImageAsURL} from '../../desktop/resolve-root'
import * as shared from './icon.shared'

export default class Icon extends Component {
  props: Props;

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
    const isFontIcon = iconType.startsWith('fa-')

    if (isFontIcon) {
      return <FontIcon
        title={this.props.hint}
        style={{...globalStyles.noSelect, ...styles.icon, ...this.props.style}}
        className={`fa ${iconType} ${this.props.className}`}
        color={color} // TODO (AW): this does nothing, color must be set in styles
        hoverColor={this.props.onClick ? hoverColor : null}
        onMouseEnter={this.props.onMouseEnter}
        onMouseLeave={this.props.onMouseLeave}
        onClick={this.props.onClick} />
    } else {
      return <img
        className={this.props.className}
        title={this.props.hint}
        style={{...globalStyles.noSelect, ...this.props.style}}
        onClick={this.props.onClick}
        srcSet={imgPath(this.props.type, ext)} />
    }
  }
}

const imgName = (type, ext, mult) => `${resolveImageAsURL('icons', type)}${mult > 1 ? `@${mult}x` : ''}.${ext} ${mult}x`
const imgPath = (type, ext) => [1, 2, 3].map(mult => imgName(type, ext, mult)).join(', ')

export const styles = {
  icon: {
    fontSize: 16,
  },
}
