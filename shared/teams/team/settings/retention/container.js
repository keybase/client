// @flow
import {connect, compose, lifecycle, type TypedState} from '../../../../util/container'
import {getTeamRetentionPolicy, makeRetentionPolicy} from '../../../../constants/teams'
import {createGetTeamRetentionPolicy} from '../../../../actions/teams-gen'
import {navigateAppend} from '../../../../actions/route-tree'
import type {ConversationIDKey} from '../../../../constants/types/chat2'
import RetentionPicker from './'

export type OwnProps = {
  conversationIDKey?: ConversationIDKey,
  teamname: string,
  isTeamWide: boolean,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  // let policy: ?RetentionPolicy // TODO (DESKTOP-6062)
  const teamPolicy = getTeamRetentionPolicy(state, ownProps.teamname)

  return {
    policy: ownProps.isTeamWide ? teamPolicy : makeRetentionPolicy({}),
    teamPolicy: ownProps.isTeamWide ? undefined : teamPolicy,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {teamname}: OwnProps) => ({
  _loadTeamPolicy: () => dispatch(createGetTeamRetentionPolicy({teamname})),
  onShowDropdown: (items, target) =>
    dispatch(
      navigateAppend([
        {
          selected: 'retentionDropdown',
          props: {items, position: 'top left', targetRect: target && target.getBoundingClientRect()},
        },
      ])
    ),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeamPolicy()
    },
  })
)(RetentionPicker)
