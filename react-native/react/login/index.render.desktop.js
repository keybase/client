/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from '../base-react'
import {globalStyles} from '../styles/style-guide'
import Carousel from '../util/carousel.desktop'

import type {LoginRenderProps} from './index.render'

export default class LoginRender extends Component {
  props: LoginRenderProps;

  render (): ReactElement {
    const FormComponent = this.props.formComponent
    return (
      <div style={{...globalStyles.flexBoxRow, ...styles.container}}>
        <Carousel style={{width: 400}} itemWidth={340}/>
        <div style={styles.loginForm}>
          <FormComponent/>
        </div>
      </div>
    )
  }
}

export const loginResizeTo = {width: 700, height: 500}

const styles = {
  container: {
    height: loginResizeTo.height,
    width: loginResizeTo.width,
    overflow: 'hidden'
  },

  loginForm: {
    ...globalStyles.flexBoxColumn,
    flex: 1,
    paddingRight: 20,
    paddingLeft: 20,
    boxShadow: `-2px 0px 2px rgba(0, 0, 0, 0.12)`
  },

  topMargin: {
    marginTop: 20
  }
}
