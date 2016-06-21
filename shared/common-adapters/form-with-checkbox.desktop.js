// @flow
import React, {Component} from 'react'
import {Checkbox, Input} from './index'

import {globalStyles} from '../styles/style-guide'

import type {Props} from './form-with-checkbox'
import type {Props as CheckboxProps} from './checkbox'

export default class FormWithCheckbox extends Component {
  props: Props;

  render () {
    const {inputProps, checkboxesProps} = this.props

    return (
      <div style={{...globalStyles.flexBoxColumn, marginBottom: 15, ...this.props.style}}>
        <Input errorStyle={{marginTop: 26}} {...inputProps} />
        <div style={{...styles.checkboxContainer, ...this.props.checkboxContainerStyle}}>
          {checkboxesProps.map(p => {
            const checkProps: CheckboxProps = {key: p.label, ...p}
            return <Checkbox {...checkProps} />
          })}
        </div>
      </div>
    )
  }
}

const styles = {
  checkboxContainer: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'center',
    position: 'relative',
    bottom: 7,
  },
}
