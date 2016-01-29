/* @flow */

import React, {Component} from 'react'
import Text, {styles as TextStyles} from './text'
import {globalStyles} from '../styles/style-guide'
import type {Props} from './checkbox'

export default class Checkbox extends Component {
  props: Props;

  render (): ReactElement {
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
  style: React.PropTypes.object
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
