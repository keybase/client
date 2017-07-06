// @flow
import Icon from './icon'
import React, {Component} from 'react'
import Text from './text'
import type {Props} from './checkbox'
import {globalStyles, globalColors, transition} from '../styles'

export const CHECKBOX_SIZE = 13
export const CHECKBOX_MARGIN = 8

class Checkbox extends Component<void, Props, void> {
  render() {
    let borderColor = globalColors.blue

    if (this.props.disabled && !this.props.checked) {
      borderColor = globalColors.black_10
    }

    const boxStyle = {
      ...transition('background'),
      width: CHECKBOX_SIZE,
      height: CHECKBOX_SIZE,
      marginRight: CHECKBOX_MARGIN,
      position: 'relative',
      border: `solid 1px ${borderColor}`,
      backgroundColor: this.props.checked ? globalColors.blue : 'inherit',
      opacity: this.props.disabled && this.props.checked ? 0.4 : 1,
    }

    const clickableStyle = this.props.disabled ? {} : globalStyles.clickable

    return (
      <div
        style={{...styleContainer, ...clickableStyle, ...this.props.style}}
        onClick={this.props.disabled ? undefined : () => this.props.onCheck(!this.props.checked)}
      >
        <div style={boxStyle}>
          <Icon type="iconfont-check" style={{...styleIcon, ...(this.props.checked ? {} : {opacity: 0})}} />
        </div>
        <Text type="Body" small={true} style={{color: globalColors.black_75}}>
          {this.props.label}
        </Text>
      </div>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const styleIcon = {
  ...transition('opacity'),
  color: globalColors.white,
  hoverColor: globalColors.white,
  position: 'absolute',
  left: 0,
  fontSize: 11,
}

export default Checkbox
