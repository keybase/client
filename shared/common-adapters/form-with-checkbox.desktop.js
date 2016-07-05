// @flow
import React, {Component} from 'react'
import {Checkbox, Input, Box} from './index'

import {globalStyles} from '../styles/style-guide'

import type {Props} from './form-with-checkbox'
import type {Props as CheckboxProps} from './checkbox'

export default class FormWithCheckbox extends Component {
  props: Props;

  render () {
    const {inputProps, checkboxesProps} = this.props

    return (
      <Box style={{...globalStyles.flexBoxColumn, marginBottom: 15, ...this.props.style}}>
        <Input errorStyle={{marginTop: 26}} {...inputProps} />
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
    justifyContent: 'center',
    position: 'relative',
    bottom: 7,
  },
}
