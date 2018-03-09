// @flow
import * as Chat2Gen from '../actions/chat2-gen'
import {Channel} from './channel'
import {connect, type TypedState} from '../util/container'
import {pathSelector} from '../actions/route-tree'

const mapStateToProps = (state: TypedState) => {
  return {
    currentPath: pathSelector(state),
  }
}

const mapDispatchToProps = (dispatch, {convID}) => ({
  onClick: currentPath => dispatch(Chat2Gen.createSelectConversation({conversationIDKey: convID})),
})

const mergeProps = ({currentPath}, {onClick}, ownProps) => {
  return {
    ...ownProps,
    onClick: () => onClick(currentPath),
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Channel)
