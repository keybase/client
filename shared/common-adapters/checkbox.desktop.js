/* @flow */

import React, {Component} from 'react'
import Text from './text'
import Icon from './icon'
import {globalStyles, globalColors, transition} from '../styles/style-guide'
import type {Props} from './checkbox'

export default class Checkbox extends Component {
  props: Props;

  render () {
    let borderColor = globalColors.blue

    if (this.props.disabled && !this.props.checked) {
      borderColor = globalColors.black_10
    }

    const boxStyle = {
      ...transition('background'),
      width: 13,
      height: 13,
      marginRight: 6,
      position: 'relative',
      border: `solid 1px ${borderColor}`,
      backgroundColor: this.props.checked ? globalColors.blue : 'inherit',
      opacity: (this.props.disabled && this.props.checked) ? 0.4 : 1,
    }

    const clickableStyle = this.props.disabled ? {} : globalStyles.clickable

    return (
      <div style={{...styles.container, ...clickableStyle, ...this.props.style}} onClick={this.props.disabled ? undefined : () => this.props.onCheck(!this.props.checked)}>
        <div style={boxStyle}>
          <Icon type='fa-check' style={{...styles.icon, ...(this.props.checked ? {} : {opacity: 0})}} />
        </div>
        <Text type='Body' small style={{color: globalColors.black_75}}>{this.props.label}</Text>
      </div>
    )
  }
}

Checkbox.propTypes = {
  label: React.PropTypes.string.isRequired,
  onCheck: React.PropTypes.func.isRequired,
  checked: React.PropTypes.bool.isRequired,
  style: React.PropTypes.object,
  disabled: React.PropTypes.bool,
}

const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  icon: {
    ...transition('opacity'),
    color: globalColors.white,
    hoverColor: globalColors.white,
    position: 'absolute',
    top: 1,
    left: 0,
    fontSize: 11,
  },
}
