/* @flow */

import React, {Component} from 'react'
import {globalStyles} from '../styles/style-guide'
import Box from './box'
import Input from './input'
import Checkbox from './checkbox'

import type {Props} from './form-with-checkbox'
import type {Props as CheckboxProps} from './checkbox'

export default class FormWithCheckbox extends Component<void, Props, void> {
  render () {
    const {inputProps, checkboxesProps} = this.props

    return (
      <Box style={{...globalStyles.flexBoxColumn, marginBottom: 30, ...this.props.style}}>
        <Input errorStyle={{marginTop: 32}} {...inputProps} />
        <Box style={{...styles.checkboxContainer, ...this.props.checkboxContainerStyle}}>
          {checkboxesProps.map(p => {
            const checkProps: CheckboxProps = {key: p.label, ...p}
            return <Checkbox {...checkProps} />
          })}
        </Box>
      </Box>
    )
  }
}

const styles = {
  checkboxContainer: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'space-around',
    position: 'relative',
    top: 7,
  },
}
