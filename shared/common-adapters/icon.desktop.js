/* @flow */

import React, {Component} from 'react'
import {globalColors} from '../styles/style-guide'
import {FontIcon} from 'material-ui'
import type {Props} from './icon'

export default class Icon extends Component {
  props: Props;

  render (): ReactElement {
    const color = this.props.style && this.props.style.color || (this.props.opacity ? globalColors.grey1 : globalColors.grey2)
    const hoverColor = this.props.style && this.props.style.hoverColor || (this.props.opacity ? globalColors.black : globalColors.grey1)

    return <FontIcon
      title={this.props.hint}
      style={{...styles.icon, opacity: this.props.opacity ? 0.35 : 1.0, ...this.props.style}}
      className={`fa ${this.props.type}`}
      color={color}
      hoverColor={hoverColor}
      onMouseEnter={this.props.onMouseEnter}
      onMouseLeave={this.props.onMouseLeave}
      onClick={this.props.onClick}/>
  }
}

Icon.propTypes = {
  type: React.PropTypes.string.isRequired,
  opacity: React.PropTypes.bool,
  hint: React.PropTypes.string,
  onClick: React.PropTypes.func,
  onMouseEnter: React.PropTypes.func,
  onMouseLeave: React.PropTypes.func,
  style: React.PropTypes.object
}

export const styles = {
  icon: {
    height: 16,
    width: 16,
    fontSize: 16
  }
}
