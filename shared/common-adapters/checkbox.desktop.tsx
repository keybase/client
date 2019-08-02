import React, {Component} from 'react'
import Box from './box'
import Icon from './icon'
import Text from './text'
import {Props} from './checkbox'
import * as Styles from '../styles'

const Kb = {
  Box,
  Icon,
  Text,
}

export const CHECKBOX_SIZE = 13
export const CHECKBOX_MARGIN = 8

class Checkbox extends Component<Props> {
  render() {
    return (
      <Kb.Box
        style={Styles.collapseStyles([
          styles.container,
          !this.props.disabled && Styles.desktopStyles.clickable,
          this.props.style,
        ])}
        onClick={e =>
          // If something in labelComponent needs to catch a click without calling this, use
          // event.preventDefault()
          this.props.disabled || e.defaultPrevented
            ? undefined
            : this.props.onCheck && this.props.onCheck(!this.props.checked)
        }
      >
        <Kb.Icon
          boxStyle={Styles.collapseStyles([
            styles.checkbox,
            this.props.checked && styles.checkboxChecked,
            this.props.disabled && styles.checkboxInactive,
            this.props.disabled && this.props.checked && styles.semiTransparent,
          ])}
          type="iconfont-check"
          style={Styles.collapseStyles([styles.icon, !this.props.checked && styles.transparent])}
          hoverColor={Styles.globalColors.white}
          color={Styles.globalColors.white}
          fontSize={9}
        />
        <Kb.Text type="Body" style={Styles.collapseStyles([
            styles.text,
            this.props.disabled && styles.semiLessTransparent,
          ])}>
          {this.props.labelComponent || this.props.label}
        </Kb.Text>
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  checkbox: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.transition('background'),
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_20,
    borderRadius: 2,
    borderStyle: 'solid',
    borderWidth: 1,
    height: CHECKBOX_SIZE,
    justifyContent: 'center',
    marginRight: CHECKBOX_MARGIN,
    marginTop: 2,
    position: 'relative',
    width: CHECKBOX_SIZE,
  },
  checkboxChecked: {
    backgroundColor: Styles.globalColors.blue,
    borderColor: Styles.globalColors.blue,
  },
  checkboxInactive: {
    borderColor: Styles.globalColors.black_10,
  },
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    paddingBottom: 2,
    paddingTop: 2,
  },
  icon: {
    ...Styles.transition('opacity'),
    alignSelf: 'center',
  },
  opaque: {
    opacity: 1,
  },
  semiLessTransparent: {
    opacity: 0.3,
  },
  semiTransparent: {
    opacity: 0.4,
  },
  text: {
    color: Styles.globalColors.black,
  },
  transparent: {
    opacity: 0,
  },
})

export default Checkbox
