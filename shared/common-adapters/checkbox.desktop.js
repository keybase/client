// @flow
import Icon from './icon'
import React, {Component} from 'react'
import Text from './text'
import type {Props} from './checkbox'
import {collapseStyles, globalStyles, globalColors, transition, desktopStyles} from '../styles'

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
      backgroundColor: this.props.checked ? globalColors.blue : 'inherit',
      border: `solid 1px ${borderColor}`,
      borderRadius: 2,
      height: CHECKBOX_SIZE,
      marginRight: CHECKBOX_MARGIN,
      marginTop: 2,
      opacity: this.props.disabled && this.props.checked ? 0.4 : 1,
      position: 'relative',
      width: CHECKBOX_SIZE,
    }

    const clickableStyle = this.props.disabled ? {} : desktopStyles.clickable

    return (
      <div
        style={collapseStyles([styleContainer, clickableStyle, this.props.style])}
        onClick={e =>
          // If something in labelComponent needs to catch a click without calling this, use
          // event.preventDefault()
          this.props.disabled || e.defaultPrevented
            ? undefined
            : this.props.onCheck && this.props.onCheck(!this.props.checked)
        }
      >
        <div style={boxStyle}>
          <Icon
            type="iconfont-check"
            style={collapseStyles([styleIcon, this.props.checked ? {} : {opacity: 0}])}
            hoverColor={globalColors.white}
            color={globalColors.white}
            fontSize={9}
          />
        </div>
        <Text type="Body" style={collapseStyles([styleText, this.props.disabled && {opacity: 0.3}])}>
          {this.props.labelComponent || this.props.label}
        </Text>
      </div>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  paddingBottom: 2,
  paddingTop: 2,
}

const styleIcon = {
  ...transition('opacity'),
  left: 1,
  position: 'absolute',
  top: 1,
}

const styleText = {
  color: globalColors.black_75,
}

export default Checkbox
