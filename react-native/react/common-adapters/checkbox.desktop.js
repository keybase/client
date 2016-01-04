/* @flow */

import React, {Component} from '../base-react'
import Text, {styles as TextStyles} from './text'
import {globalStyles} from '../styles/style-guide'

export default class Checkbox extends Component {
  render (): ReactElement {
    return (
      <div style={styles.container} onClick={() => this.props.onCheck(!this.props.checked)}>
        <i style={styles.check} className={`fa ${this.props.checked ? 'fa-check-square-o' : 'fa-square-o'}`}></i>
        <Text type='Body' small>{this.props.label}</Text>
      </div>
    )
  }
}

Checkbox.propTypes = {
  label: React.PropTypes.string.isRequired,
  onCheck: React.PropTypes.func.isRequired,
  checked: React.PropTypes.bool.isRequired
}

export const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center'
  },
  check: {
    color: TextStyles.textSmallMixin.color,
    marginRight: 7,
    width: 12,
    height: 14
  }
}
