import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import * as TeamConstants from '../../../../constants/teams'
import RetentionNotice from '.'
import {getMeta} from '../../../../constants/chat2'
import {makeRetentionNotice} from '../../../../util/teams'

type OwnProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  measure: (() => void) | null
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const meta = getMeta(state, ownProps.conversationIDKey)
    let canChange = true
    if (meta.teamType !== 'adhoc') {
      canChange = TeamConstants.getCanPerformByID(state, meta.teamID).setRetentionPolicy
    }
    return {
      _teamType: meta.teamType,
      canChange,
      policy: meta.retentionPolicy,
      teamPolicy: meta.teamRetentionPolicy,
    }
  },
  (dispatch, ownProps: OwnProps) => ({
    onChange: () =>
      dispatch(
        Chat2Gen.createShowInfoPanel({
          conversationIDKey: ownProps.conversationIDKey,
          show: true,
          tab: 'settings',
        })
      ),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {policy, canChange, teamPolicy, _teamType} = stateProps
    const explanation = makeRetentionNotice(policy, teamPolicy, _teamType) ?? undefined
    return {
      canChange,
      explanation,
      measure: ownProps.measure ?? undefined,
      onChange: dispatchProps.onChange,
      policy,
      teamPolicy,
    }
  }
)(RetentionNotice)
