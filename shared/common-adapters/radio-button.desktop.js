// @flow
import * as React from 'react'
import Text from './text'
import type {Props} from './radio-button'
import {globalStyles, globalColors, transition} from '../styles'

export const RADIOBUTTON_SIZE = 14
export const RADIOBUTTON_MARGIN = 8

class RadioButton extends React.Component<Props, {hovered: boolean}> {
  state = {
    hovered: false,
  }

  render() {
    let borderColor = globalColors.black_10

    if (this.props.selected || (this.state.hovered && !this.props.disabled)) {
      borderColor = globalColors.blue
    }

    const boxStyle = {
      ...transition('background'),
      backgroundColor: this.props.selected ? globalColors.blue : 'inherit',
      border: `solid 1px ${borderColor}`,
      borderRadius: 100,
      height: RADIOBUTTON_SIZE,
      marginRight: RADIOBUTTON_MARGIN,
      opacity: this.props.disabled ? 0.4 : 1,
      position: 'relative',
      width: RADIOBUTTON_SIZE,
    }

    const clickableStyle = this.props.disabled ? {} : globalStyles.clickable

    return (
      <div
        style={{...styleContainer, ...clickableStyle, ...this.props.style}}
        onClick={this.props.disabled ? undefined : () => this.props.onSelect(!this.props.selected)}
        onMouseEnter={() => this.setState({hovered: true})}
        onMouseLeave={() => this.setState({hovered: false})}
      >
        <div style={boxStyle}>
          <div style={styleIcon} />
        </div>
        <Text type="Body" small={true} style={{color: globalColors.black_75}}>{this.props.label}</Text>
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
  border: `solid 3px ${globalColors.white}`,
  borderRadius: 10,
  color: globalColors.white,
  hoverColor: globalColors.white,
  left: 3,
  position: 'absolute',
  top: 3,
}

export default RadioButton
