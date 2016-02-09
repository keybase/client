/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../styles/style-guide'

import type {Props} from './form.render'

export default class Render extends Component {
  props: Props;

  render (): ReactElement {
    const FormComponent = this.props.formComponent
    return (
      <div style={styles.loginForm}>
        <FormComponent/>
      </div>
    )
  }
}

export const formResizeTo = {width: 550, height: 605}

const styles = {
  loginForm: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },

  topMargin: {
    marginTop: 20
  }
}
