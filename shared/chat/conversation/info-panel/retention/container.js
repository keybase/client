// @flow
import {connect, compose, lifecycle, type TypedState} from '../../../../util/container'
import {getTeamRetentionPolicy, makeRetentionPolicy} from '../../../../constants/teams'
import {createGetTeamRetentionPolicy} from '../../../../actions/teams-gen'
import type {ConversationIDKey} from '../../../../constants/types/chat2'
import type {RetentionPolicy} from '../../../../constants/types/teams'
import RetentionPicker from './'

export type OwnProps = {
  conversationIDKey?: ConversationIDKey,
  teamname: string,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  // let policy: ?RetentionPolicy // TODO
  let teamPolicy: ?RetentionPolicy
  let _loaded = true

  teamPolicy = getTeamRetentionPolicy(state, ownProps.teamname)
  if (!teamPolicy) {
    _loaded = false
  }

  return {
    _loaded,
    policy: makeRetentionPolicy({}),
    teamPolicy,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {teamname}: OwnProps) => ({
  _loadTeamPolicy: () => dispatch(createGetTeamRetentionPolicy({teamname})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeamPolicy()
    },
  })
)(RetentionPicker)
