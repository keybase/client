import React, {Component} from 'react'
import Render from './component-sheet.render'

export default class ComponentSheet extends Component {
  render () {
    return <Render {...this.props} />
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Components'},
    }
  }
}
