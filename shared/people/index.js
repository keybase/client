// @flow
// $FlowIssue
import PeopleRender from './index.render'
import React, {Component} from 'react'
import flags from '../util/feature-flags'
import {connect} from 'react-redux'

class People extends Component {
  render () {
    return <PeopleRender showComingSoon={!flags.tabPeopleEnabled} />
  }

  static parseRoute () {
    return {componentAtTop: {title: 'People'}}
  }
}

export default connect()(People)
