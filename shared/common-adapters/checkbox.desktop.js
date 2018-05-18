// @flow
import Icon from './icon'
import * as React from 'react'
import Text from './text'
import {
  collapseStyles,
  globalStyles,
  globalColors,
  transition,
  desktopStyles,
  type StylesCrossPlatform,
} from '../styles'

export type Props = {|
  key?: string,
  label?: string,
  labelComponent?: React.Node,
  onCheck: ?(newCheckedValue: boolean) => void,
  checked: boolean,
  style?: StylesCrossPlatform,
  disabled?: boolean,
|}

export const CHECKBOX_SIZE = 13
export const CHECKBOX_MARGIN = 8

class Checkbox extends React.Component<Props> {
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
  position: 'absolute',
  left: 1,
  top: 1,
}

export default Checkbox
