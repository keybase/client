// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'

class Folders extends Component {
  render () {
    return <Render
      privateBadge={0}
      private={{isPublic: false}}
      publicBadge={0}
      public={{isPublic: true}}
      onSwitchTab={showingPublic => {}}
      />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'Folders'}}
  }
}

export default connect()(Folders)
