// @flow
import React, {Component} from 'react'
// $FlowIssue
import Render from './component-sheet.render'

class ComponentSheet extends Component {
  render () {
    return <Render {...this.props} />
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Components'},
    }
  }
}

export default ComponentSheet
