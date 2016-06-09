// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './render'
import flags from '../util/feature-flags'

type Props = {}

type State = {
  showingPrivate: boolean
}

class Folders extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      showingPrivate: true
    }
  }

  render () {
    return <Render
      onRekey={() => {}}
      smallMode={false}
      showComingSoon={!flags.tabFoldersEnabled}
      privateBadge={0}
      private={{isPublic: false}}
      publicBadge={0}
      public={{isPublic: true}}
      onSwitchTab={showingPrivate => this.setState({showingPrivate})}
      showingPrivate={this.state.showingPrivate}
      />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'Folders'}}
  }
}

export default connect()(Folders)
