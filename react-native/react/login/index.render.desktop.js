/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from '../base-react'
import {globalStyles} from '../styles/style-guide'

import {remote} from 'electron'

import {Text} from '../common-adapters'
import Carousel from '../util/carousel.desktop'

import type {LoginRenderProps} from './index.render'

export default class LoginRender extends Component {
  props: LoginRenderProps;

  window: ?any;
  originalSize: ?{width: number, height: number};

  componentWillMount () {
    this.window = remote.getCurrentWindow()
    const [width, height] = this.window.getSize()
    this.originalSize = {width, height}
    this.window && this.window.setSize(styles.container.width, styles.container.height + 20 /* for frame */, true)
    this.window && this.window.setResizable(false)
  }

  componentWillUnmount () {
    if (this.originalSize) {
      const {width, height} = this.originalSize
      this.window && this.window.setSize(width, height, true)
    }
    this.window && this.window.setResizable(true)
  }

  render (): ReactElement {
    return (
      <div style={{...globalStyles.flexBoxRow, ...styles.container}}>
        <Carousel style={{width: 400}} itemWidth={340}/>
        <div style={styles.loginForm}>
          <Text style={styles.topMargin} type='Header'>Welcome to Keybase!</Text>
          <Text style={styles.topMargin} type='Body'>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus sagittis lacus vel augue laoreet.</Text>
          <Text style={styles.topMargin} type='Body' link onClick={this.props.onSignup}>Create Account</Text>
          <Text style={styles.topMargin} type='Body' link onClick={this.props.onLogin}>Log In</Text>
        </div>
      </div>
    )
  }
}

const styles = {
  container: {
    height: 500,
    width: 700,
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
