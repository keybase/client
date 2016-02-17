// @flow
import React, {Component} from 'react'
import {Checkbox, Input} from './index'

import {globalStyles} from '../styles/style-guide'

import type {Props} from './form-with-checkbox'

export default class FormWithCheckbox extends Component {
  props: Props;

  render () {
    const {inputProps, checkboxesProps} = this.props

    return (
      <div style={{...globalStyles.flexBoxColumn, marginBottom: 15}}>
        <Input style={{marginBottom: 0}} errorStyle={{marginTop: 24, textAlign: 'center'}} {...inputProps}/>
        <div style={styles.checkboxContainer}>
          {checkboxesProps.map(p => <Checkbox key={p.label} {...p}/>)}
        </div>
      </div>
    )
  }
}

const styles = {
  checkboxContainer: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'space-around',
    position: 'relative',
    bottom: 8
  }
}
