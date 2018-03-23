// @flow
import {connect, compose, lifecycle, type TypedState} from '../../../../util/container'
import {getTeamRetentionPolicy} from '../../../../constants/teams'
import {getConversationRetentionPolicy} from '../../../../constants/chat2/meta'
import {type _RetentionPolicy} from '../../../../constants/types/teams'
import {createGetTeamRetentionPolicy} from '../../../../actions/teams-gen'
import {navigateAppend} from '../../../../actions/route-tree'
import type {ConversationIDKey} from '../../../../constants/types/chat2'
import RetentionPicker from './'

// type 'simple' = we pass up selected values and parent deals with showing warning popup
// type 'auto' = we show the popup and handle everything (TODO DESKTOP-6062)
export type OwnProps = {
  conversationIDKey?: ConversationIDKey,
  teamname: string,
  isTeamWide: boolean, // the state where this is false is TODO in DESKTOP-6062
  type: 'simple' | 'auto',
  onSelect?: (policy: _RetentionPolicy, changed: boolean, decreased: boolean) => void,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const teamPolicy = getTeamRetentionPolicy(state, ownProps.teamname)
  const teamPolicyJS = !!teamPolicy && teamPolicy.toJS()
  let policy = teamPolicyJS
  if (!ownProps.isTeamWide && ownProps.conversationIDKey) {
    const p = getConversationRetentionPolicy(state, ownProps.conversationIDKey)
    if (p) {
      policy = p.toJS()
    }
  }

  return {
    policy,
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
  onSelect: (policy: _RetentionPolicy, changed: boolean, decreased: boolean) => {
    if (type === 'simple' && onSelect) {
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
