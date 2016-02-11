import React, {Component} from 'react'
import Render from './components-tracker.render'

export default class ComponentsTracker extends Component {
  render () {
    return <Render {...this.props}/>
  }

  static parseRoute () {
    return {
      componentAtTop: {title: 'Components (Tracker)'}
    }
  }
}
