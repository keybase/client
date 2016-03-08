/* @flow */

import React, {Component} from 'react'
import Text, {styles as TextStyles} from './text'
import Icon from './icon'
import {globalStyles, globalColorsDZ2, transition} from '../styles/style-guide'
import type {Props} from './checkbox'

export default class Checkbox extends Component {
  props: Props;

  render () {
    if (!this.props.dz2) {
      return this.renderOld()
    }

    let borderColor = globalColorsDZ2.blue

    if (this.props.disabled && !this.props.checked) {
      borderColor = globalColorsDZ2.black10
    }

    const boxStyle = {
      ...transition('background'),
      width: 13,
      height: 13,
      marginRight: 6,
      position: 'relative',
      border: `solid 1px ${borderColor}`,
      backgroundColor: this.props.checked ? globalColorsDZ2.blue : 'inherit',
      opacity: (this.props.disabled && this.props.checked) ? 0.4 : 1
    }

    const clickableStyle = this.props.disabled ? {} : globalStyles.clickable

    return (
      <div style={{...dz2Styles.container, ...clickableStyle, ...this.props.style}} onClick={this.props.disabled ? undefined : () => this.props.onCheck(!this.props.checked)}>
        <div style={boxStyle}>
          <Icon type='fa-check' style={{...dz2Styles.icon, ...(this.props.checked ? {} : {opacity: 0})}} />
        </div>
        <Text type='Body' small style={{color: this.props.checked ? globalColorsDZ2.black75 : globalColorsDZ2.black75}}>{this.props.label}</Text>
      </div>
    )
  }

  renderOld () {
    const color = this.props.style && this.props.style.color
    return (
      <div style={{...styles.container, ...this.props.style}} onClick={() => this.props.onCheck(!this.props.checked)}>
        <i style={styles.check} className={`fa ${this.props.checked ? 'fa-check-square-o' : 'fa-square-o'}`}></i>
        <Text type='Body' small style={{...styles.text, ...{color}}}>{this.props.label}</Text>
      </div>
    )
  }
}

Checkbox.propTypes = {
  label: React.PropTypes.string.isRequired,
  onCheck: React.PropTypes.func.isRequired,
  checked: React.PropTypes.bool.isRequired,
  style: React.PropTypes.object,
  dz2: React.PropTypes.bool,
  disabled: React.PropTypes.bool
}

const dz2Styles = {
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center'
  },
  icon: {
    ...transition('opacity'),
    color: globalColorsDZ2.white,
    hoverColor: globalColorsDZ2.white,
    position: 'absolute',
    top: 0,
    left: 0,
    fontSize: 11
  }
}

export const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.clickable,
    color: TextStyles.textSmallMixin.color,
    alignItems: 'center'
  },
  check: {
    marginRight: 7,
    width: 12,
    height: 14
  },
  text: {
    ...globalStyles.clickable
  }
}
