// @flow
import * as Chat2Gen from '../actions/chat2-gen'
import {Channel} from './channel'
import {connect, type TypedState, type Dispatch} from '../util/container'
import {pathSelector} from '../actions/route-tree'

const mapStateToProps = (state: TypedState) => ({
  _currentPath: pathSelector(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {convID}) => ({
  onClick: currentPath => dispatch(Chat2Gen.createSelectConversation({conversationIDKey: convID, reason: 'messageLink'})),
})

const mergeProps = ({_currentPath}, {onClick}) => ({
  onClick: () => onClick(_currentPath),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Channel)
