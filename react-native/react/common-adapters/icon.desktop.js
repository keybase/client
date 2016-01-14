/* @flow */

import React, {Component} from '../base-react'
import {globalStyles} from '../styles/style-guide'
import type {Props} from './icon'

export default class Icon extends Component {
  props: Props;

  render (): ReactElement {
    return <i
      title={this.props.hint}
      style={{...styles.icon, ...this.props.style, ...(this.props.onClick ? globalStyles.clickable : {})}}
      className={`fa ${this.props.type}`}
      onClick={this.props.onClick}></i>
  }
}

Icon.propTypes = {
  type: React.PropTypes.string.isRequired,
  hint: React.PropTypes.string,
  onClick: React.PropTypes.func.isRequired,
  style: React.PropTypes.object
}

export const styles = {
  icon: {
    height: 16,
    width: 16,
    fontSize: 16
  }
}
