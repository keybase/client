// @flow
import * as TeamsGen from '../../../../actions/teams-gen'
import {createSetConvRetentionPolicy} from '../../../../actions/chat2-gen'
import {connect, compose, lifecycle, type TypedState} from '../../../../util/container'
import {getTeamRetentionPolicy} from '../../../../constants/teams'
import {getConversationRetentionPolicy} from '../../../../constants/chat2/meta'
import {type _RetentionPolicy} from '../../../../constants/types/teams'
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
  type: 'simple' | 'auto',
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

const mapDispatchToProps = (
  dispatch: Dispatch,
  {conversationIDKey, teamname, onSelect, type, isTeamWide}: OwnProps
) => ({
  _loadTeamPolicy: () => dispatch(TeamsGen.createGetTeamRetentionPolicy({teamname})),
  onShowDropdown: (items, target) =>
    dispatch(
      navigateAppend([
        {
          selected: 'retentionDropdown',
          props: {items, position: 'top center', targetRect: target && target.getBoundingClientRect()},
        },
      ])
    ),
  onShowWarning: (days: number, onConfirm: () => void, onCancel: () => void) => {
    dispatch(
      navigateAppend([
        {
          selected: 'retentionWarning',
          props: {days, onCancel, onConfirm},
        },
      ])
    )
  },
  setRetentionPolicy: (policy: _RetentionPolicy) => {
    if (isTeamWide) {
      dispatch(TeamsGen.createSetTeamRetentionPolicy({policy, teamname}))
    } else {
      if (!conversationIDKey) {
        throw new Error('Tried to set conv retention policy with no ConversationIDKey')
      }
      dispatch(createSetConvRetentionPolicy({policy, conversationIDKey}))
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
