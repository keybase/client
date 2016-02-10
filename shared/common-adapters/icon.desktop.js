/* @flow */

import React, {Component} from 'react'
import {globalColors} from '../styles/style-guide'
import {FontIcon} from 'material-ui'
import type {Props} from './icon'

export default class Icon extends Component {
  props: Props;

  render (): ReactElement {
    const color = this.props.style && this.props.style.color || globalColors.grey2
    const hoverColor = this.props.style && this.props.style.hoverColor || globalColors.grey1

    return <FontIcon
      title={this.props.hint}
      style={{...styles.icon, ...this.props.style}}
      className={`fa ${this.props.type}`}
      color={color}
      hoverColor={hoverColor}
      onClick={this.props.onClick}/>
  }
}

Icon.propTypes = {
  type: React.PropTypes.string.isRequired,
  hint: React.PropTypes.string,
  onClick: React.PropTypes.func,
  style: React.PropTypes.object
}

export const styles = {
  icon: {
    height: 16,
    width: 16,
    fontSize: 16
  }
}
