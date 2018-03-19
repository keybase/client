// @flow
import {connect, compose, lifecycle, type TypedState} from '../../../../util/container'
import {getTeamRetentionPolicy, makeRetentionPolicy} from '../../../../constants/teams'
import {createGetTeamRetentionPolicy} from '../../../../actions/teams-gen'
import type {ConversationIDKey} from '../../../../constants/types/chat2'
import RetentionPicker from './'

export type OwnProps = {
  conversationIDKey?: ConversationIDKey,
  teamname: string,
  isTeamWide: boolean,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  // let policy: ?RetentionPolicy // TODO
  const teamPolicy = getTeamRetentionPolicy(state, ownProps.teamname)

  return {
    policy: ownProps.isTeamWide ? teamPolicy : makeRetentionPolicy({}),
    teamPolicy: ownProps.isTeamWide ? undefined : teamPolicy,
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
