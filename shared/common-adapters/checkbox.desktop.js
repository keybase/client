// @flow
import Icon from './icon'
import React, {Component} from 'react'
import Text from './text'
import type {Props} from './checkbox'
import {globalStyles, globalColors, transition, desktopStyles} from '../styles'

export const CHECKBOX_SIZE = 13
export const CHECKBOX_MARGIN = 8

class Checkbox extends Component<Props> {
  render() {
    let borderColor = this.props.checked ? globalColors.blue : globalColors.black_20

    if (this.props.disabled && !this.props.checked) {
      borderColor = globalColors.black_10
    }

    const boxStyle = {
      ...transition('background'),
      width: CHECKBOX_SIZE,
      height: CHECKBOX_SIZE,
      marginRight: CHECKBOX_MARGIN,
      marginTop: 2,
      position: 'relative',
      border: `solid 1px ${borderColor}`,
      borderRadius: 2,
      backgroundColor: this.props.checked ? globalColors.blue : 'inherit',
      opacity: this.props.disabled && this.props.checked ? 0.4 : 1,
    }

    const clickableStyle = this.props.disabled ? {} : desktopStyles.clickable

    return (
      <div
        style={{...styleContainer, ...clickableStyle, ...this.props.style}}
        onClick={e =>
          // If something in labelComponent needs to catch a click without calling this, use
          // event.preventDefault()
          this.props.disabled || e.defaultPrevented
            ? undefined
            : this.props.onCheck && this.props.onCheck(!this.props.checked)
        }
      >
        <div style={boxStyle}>
          <Icon type="iconfont-check" style={{...styleIcon, ...(this.props.checked ? {} : {opacity: 0})}} />
        </div>
        <Text type="Body" style={{color: globalColors.black_75}}>
          {this.props.labelComponent || this.props.label}
        </Text>
      </div>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
}

const styleIcon = {
  ...transition('opacity'),
  color: globalColors.white,
  hoverColor: globalColors.white,
  position: 'absolute',
  left: 1,
  top: 1,
  fontSize: 9,
}

export default Checkbox
