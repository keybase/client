// @flow

import Search from './search'
import ConversationList from './inbox/container'
import {compose, renderComponent, branch} from 'recompose'
import {connect} from 'react-redux'

export default compose(
  connect(({chat: {inSearch}}) => ({
    inSearch,
  })),
  branch(props => props.inSearch, renderComponent(Search))
)(ConversationList)
