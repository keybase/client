import Box from './box'
import Checkbox, {Props as CheckboxProps} from './checkbox'
import Input from './input'
import React, {Component} from 'react'
import {Props} from './form-with-checkbox'
import {collapseStyles, globalStyles} from '../styles'

class FormWithCheckbox extends Component<Props> {
  render() {
    const {inputProps, checkboxesProps} = this.props

    return (
      <Box style={collapseStyles([globalStyles.flexBoxColumn, {marginBottom: 30}, this.props.style])}>
        <Input {...inputProps} />
        <Box style={collapseStyles([styles.checkboxContainer, this.props.checkboxContainerStyle])}>
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
