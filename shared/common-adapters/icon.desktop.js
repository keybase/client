/* @flow */

import React, {Component} from 'react'
import {globalColors} from '../styles/style-guide'
import {FontIcon} from 'material-ui'
import type {Props} from './icon'
import {resolveImage} from '../../desktop/resolve-root'
import * as shared from './icon.shared'

export default class Icon extends Component {
  props: Props;

  render () {
    let color = shared.defaultColor(this.props.type)
    let hoverColor = shared.defaultHoverColor(this.props.type)
    let iconType = shared.typeToIconMapper(this.props.type)

    if (!iconType) {
      console.error('Null iconType passed')
      return null
    }

    if (this.props.inheritColor) {
      color = 'inherit'
      hoverColor = 'inherit'
    } else {
      color = this.props.style && this.props.style.color || color || (this.props.opacity ? globalColors.lightGrey : globalColors.black40)
      hoverColor = this.props.style && this.props.style.hoverColor || hoverColor || (this.props.opacity ? globalColors.black : globalColors.black75)
    }

    const ext = shared.typeExtension(iconType)

    const isFontIcon = iconType.startsWith('fa-')

    if (isFontIcon) {
      return <FontIcon
        title={this.props.hint}
        style={{...styles.icon, ...this.props.style}}
        className={`fa ${iconType}`}
        color={color}
        hoverColor={this.props.onClick ? hoverColor : null}
        onMouseEnter={this.props.onMouseEnter}
        onMouseLeave={this.props.onMouseLeave}
        onClick={this.props.onClick}/>
    } else {
      return <img
        title={this.props.hint}
        style={{...this.props.style}}
        onClick={this.props.onClick}
        srcSet={`${[1, 2, 3].map(mult => `${resolveImage('icons', this.props.type)}${mult > 1 ? `@${mult}x` : ''}.${ext} ${mult}x`).join(', ')}`} />
    }
  }
}

export const styles = {
  icon: {
    fontSize: 16
  }
}
