import React, {Component} from 'react'
import Checkbox, {Props as CheckboxProps} from './checkbox'
import {Props} from './form-with-checkbox'
import Input from './input'
import Box from './box'
import Text from './text'
import {globalStyles, globalMargins, collapseStyles} from '../styles'

class FormWithCheckbox extends Component<Props> {
  render() {
    const {inputProps, checkboxesProps} = this.props
    const {errorText = ''} = inputProps
    const inputWOError = {...inputProps, errorStyle: {opacity: 0}, errorText: null}

    return (
      <Box
        style={collapseStyles([
          globalStyles.flexBoxColumn,
          {alignItems: 'center', marginBottom: 15},
          this.props.style,
        ])}
      >
        <Input {...inputWOError} />
        <Box style={collapseStyles([styles.checkboxContainer, this.props.checkboxContainerStyle])}>
          {checkboxesProps.map(p => {
            const checkProps: CheckboxProps = {key: p.label, ...p}
            return <Checkbox key={p.label} {...checkProps} />
          })}
        </Box>
        {!!errorText && (
          <Text center={true} type="BodySmallError" style={{marginTop: globalMargins.tiny}}>
            {errorText}
          </Text>
        )}
      </Box>
    )
  }
}

const styles = {
  checkboxContainer: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'center',
    marginTop: 7,
    position: 'relative',
  },
}

export default FormWithCheckbox
