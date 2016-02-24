/* @flow */

import React, {Component} from 'react'
import {globalColors} from '../styles/style-guide'
import {FontIcon} from 'material-ui'
import type {Props} from './icon'
import resolveRoot from '../../desktop/resolve-root'

export default class Icon extends Component {
  props: Props;

  render () {
    let color = null
    let hoverColor = null

    if (this.props.inheritColor) {
      color = 'inherit'
      hoverColor = 'inherit'
    } else {
      color = this.props.style && this.props.style.color || (this.props.opacity ? globalColors.grey1 : globalColors.grey2)
      hoverColor = this.props.style && this.props.style.hoverColor || (this.props.opacity ? globalColors.black : globalColors.grey1)
    }

    const isFontIcon = this.props.type.startsWith('fa-')

    if (isFontIcon) {
      return <FontIcon
        title={this.props.hint}
        style={{...styles.icon, opacity: this.props.opacity ? 0.35 : 1.0, ...this.props.style}}
        className={`fa ${this.props.type}`}
        color={color}
        hoverColor={this.props.onClick ? hoverColor : null}
        onMouseEnter={this.props.onMouseEnter}
        onMouseLeave={this.props.onMouseLeave}
        onClick={this.props.onClick}/>
    } else {
      return <img
        title={this.props.hint}
        style={{opacity: this.props.opacity ? 0.35 : 1.0, ...this.props.style}}
        onClick={this.props.onClick}
        srcSet={`${[1, 2, 3].map(mult => `${resolveRoot('shared/images/icons', this.props.type)}${mult > 1 ? `@${mult}x` : ''}.png ${mult}x`).join(', ')}`} />
    }
  }
}

Icon.propTypes = {
  type: React.PropTypes.string.isRequired,
  opacity: React.PropTypes.bool,
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
