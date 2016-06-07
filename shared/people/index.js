import React, {Component} from 'react'
import {connect} from 'react-redux'

import PeopleRender from './index.render'
import flags from '../util/feature-flags'

class People extends Component {
  constructor (props) {
    super(props)
    this.state = {count: 0}
  }

  handleCountIncrease () {
    this.setState({count: this.state.count + 1})
  }

  render () {
    return <PeopleRender
      showComingSoon={!flags.tabPeopleEnabled}
      count={this.state.count}
      onCount={() => this.handleCountIncrease()}
    />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'People'}}
  }
}

export default connect()(People)
