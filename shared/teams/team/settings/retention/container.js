// @flow
import {connect, compose, lifecycle, type TypedState} from '../../../../util/container'
import {getTeamRetentionPolicy} from '../../../../constants/teams'
import {getConversationRetentionPolicy} from '../../../../constants/chat2/meta'
import {type _RetentionPolicy} from '../../../../constants/types/teams'
import {createGetTeamRetentionPolicy} from '../../../../actions/teams-gen'
import {navigateAppend} from '../../../../actions/route-tree'
import type {ConversationIDKey} from '../../../../constants/types/chat2'
import RetentionPicker from './'

// if you supply an onSelect callback, this won't trigger any popup on its own
// if you don't, the selection will immediately be applied / warning shown on selection
export type OwnProps = {
  conversationIDKey?: ConversationIDKey,
  teamname: string,
  isTeamWide: boolean,
  isSmallTeam?: boolean,
  onSelect?: (policy: _RetentionPolicy, changed: boolean, decreased: boolean) => void,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const teamPolicy = getTeamRetentionPolicy(state, ownProps.teamname)
  const loading = !teamPolicy
  const teamPolicyJS = !!teamPolicy && teamPolicy.toJS()
  let policy = teamPolicyJS
  if (!ownProps.isTeamWide && ownProps.conversationIDKey) {
    const p = getConversationRetentionPolicy(state, ownProps.conversationIDKey)
    if (p) {
      policy = p.toJS()
    } else {
      throw new Error('Conv retpolicy not present in metaMap!')
    }
  }

  return {
    policy,
    loading,
    teamPolicy: ownProps.isTeamWide ? undefined : teamPolicyJS,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {teamname, onSelect, type}: OwnProps) => ({
  _loadTeamPolicy: () => dispatch(createGetTeamRetentionPolicy({teamname})),
  onShowDropdown: (items, target) =>
    dispatch(
      navigateAppend([
        {
          selected: 'retentionDropdown',
          props: {items, position: 'top center', targetRect: target && target.getBoundingClientRect()},
        },
      ])
    ),
  onSelectPolicy: (policy: _RetentionPolicy, changed: boolean, decreased: boolean) => {
    if (onSelect) {
      onSelect(policy, changed, decreased)
    } else {
      // show popup etc (TODO DESKTOP-6062)
    }
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  lifecycle({
    componentDidMount: function() {
      this.props._loadTeamPolicy()
    },
  })
)(RetentionPicker)
