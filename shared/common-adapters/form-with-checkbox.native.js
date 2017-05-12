// @flow
import Box from './box'
import Checkbox from './checkbox'
import Input from './input'
import React, {Component} from 'react'
import type {Props as CheckboxProps} from './checkbox'
import type {Props} from './form-with-checkbox'
import {globalStyles} from '../styles'

class FormWithCheckbox extends Component<void, Props, void> {
  render() {
    const {inputProps, checkboxesProps} = this.props

    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          marginBottom: 30,
          ...this.props.style,
        }}
      >
        <Input {...inputProps} />
        <Box
          style={{
            ...styles.checkboxContainer,
            ...this.props.checkboxContainerStyle,
          }}
        >
          {checkboxesProps.map(p => {
            const checkProps: CheckboxProps = {key: p.label, ...p}
            return <Checkbox key={p.label} {...checkProps} />
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

export default FormWithCheckbox
