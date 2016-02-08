/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../styles/style-guide'
import Carousel from '../util/carousel.desktop'

import type {LoginRenderProps} from './index.render'

export default class LoginRender extends Component {
  props: LoginRenderProps;

  render (): ReactElement {
    const FormComponent = this.props.formComponent
    return (
      <div style={styles.loginForm}>
        <FormComponent/>
      </div>
    )
  }
}

export const loginResizeTo = {width: 550, height: 605}

const styles = {
  loginForm: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },

  topMargin: {
    marginTop: 20
  }
}
