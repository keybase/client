// @noflow
import * as Chat2Gen from '../actions/chat2-gen'
import {Channel, type OwnProps} from './channel'
import {connect, type TypedState} from '../util/container'
import {pathSelector} from '../actions/route-tree'

const mapStateToProps = (state: TypedState) => {
  return {
    currentPath: pathSelector(state),
  }
}

const mapDispatchToProps = (dispatch, {convID}: OwnProps) => ({
  onClick: currentPath => dispatch(Chat2Gen.createSelectConversation({conversationIDKey: convID})),
})

const mergeProps = ({currentPath}, {onClick}, ownProps: OwnProps) => {
  return {
    ...ownProps,
    onClick: () => onClick(currentPath),
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Channel)
