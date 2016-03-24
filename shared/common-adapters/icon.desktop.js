/* @flow */

import React, {Component} from 'react'
import {globalColors} from '../styles/style-guide'
import {FontIcon} from 'material-ui'
import type {Props} from './icon'
import {resolveImage} from '../../desktop/resolve-root'

export default class Icon extends Component {
  props: Props;

  _defaultColor (type: Props.type): ?string {
    switch (type) {
      case 'fa-custom-icon-proof-broken':
        return globalColors.red
      case 'fa-custom-icon-proof-good-followed':
        return globalColors.green
      case 'fa-custom-icon-proof-good-new':
        return globalColors.blue2
      case 'fa-close':
        return globalColors.black20
      default:
        return null
    }
  }

  _defaultHoverColor (type: Props.type): ?string {
    switch (type) {
      case 'fa-custom-icon-proof-broken':
      case 'fa-custom-icon-proof-good-followed':
      case 'fa-custom-icon-proof-good-new':
        return this._defaultColor(type)
      case 'fa-close':
        return globalColors.black60
      default:
        return null
    }
  }

  // Some types are the same underlying icon.
  _typeToIconMapper (type: Props.type): Props.type {
    switch (type) {
      case 'fa-custom-icon-proof-good-followed':
      case 'fa-custom-icon-proof-good-new':
        return 'fa-custom-icon-proof-good'
      default:
        return type
    }
  }

  _typeExtension (type: Props.type): string {
    switch (type) {
      case 'progress-white':
      case 'progress-grey':
        return 'gif'
      default:
        return 'png'
    }
  }

  render () {
    let color = this._defaultColor(this.props.type)
    let hoverColor = this._defaultHoverColor(this.props.type)
    let iconType = this._typeToIconMapper(this.props.type)

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

    const ext = this._typeExtension(iconType)

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

Icon.propTypes = {
  type: React.PropTypes.string.isRequired,
  hint: React.PropTypes.string,
  onClick: React.PropTypes.func,
  onMouseEnter: React.PropTypes.func,
  onMouseLeave: React.PropTypes.func,
  style: React.PropTypes.object,
  inheritColor: React.PropTypes.bool
}

export const styles = {
  icon: {
    fontSize: 16
  }
}
