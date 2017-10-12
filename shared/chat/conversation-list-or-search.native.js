// @flow

import Search from './search'
import ConversationList from './inbox/container'
import {compose, renderComponent, branch} from 'recompose'
import {connect, type MapStateToProps} from 'react-redux'

const mapStateToProps: MapStateToProps<*, *, *> = ({chat: {inSearch}}) => ({
  inSearch,
})

export default compose(connect(mapStateToProps), branch(props => props.inSearch, renderComponent(Search)))(
  ConversationList
)
