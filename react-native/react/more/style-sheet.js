import React, {Component} from '../base-react'
import Render from './style-sheet.render'
import {colors} from '../styles/common'

export default class StyleSheet extends Component {
  render () {
    return <Render
      {...this.props}
      colors={colors}
    />
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Styleshet'}
    }
  }
}

