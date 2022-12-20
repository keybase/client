import * as Constants from '../../../../constants/teams'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as TeamsGen from '../../../../actions/teams-gen'
import type * as TeamsTypes from '../../../../constants/types/teams'
import RetentionPicker, {type RetentionEntityType, type Props} from '.'
import type {ConversationIDKey} from '../../../../constants/types/chat2'
import type {RetentionPolicy} from '../../../../constants/types/retention-policy'
import type {StylesCrossPlatform} from '../../../../styles'
import {createSetConvRetentionPolicy} from '../../../../actions/chat2-gen'
import {getConversationRetentionPolicy} from '../../../../constants/chat2/meta'

export type OwnProps = {
  conversationIDKey?: ConversationIDKey
  containerStyle?: StylesCrossPlatform
  dropdownStyle?: StylesCrossPlatform
  entityType: RetentionEntityType
  showSaveIndicator: boolean
  teamID: TeamsTypes.TeamID
}

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const {entityType, conversationIDKey, teamID} = ownProps

    let loading = false
    let policy: RetentionPolicy = Constants.retentionPolicies.policyRetain
    let teamPolicy: RetentionPolicy | undefined = undefined
    if (ownProps.conversationIDKey) {
      policy = getConversationRetentionPolicy(state, conversationIDKey!)
    } else if (!entityType.endsWith('team')) {
      throw new Error(`RetentionPicker needs a conversationIDKey to set ${entityType} retention policies`)
    }
    if (entityType !== 'adhoc') {
      const tempPolicy = Constants.getTeamRetentionPolicyByID(state, teamID)
      loading = !tempPolicy
      if (tempPolicy) {
        if (entityType === 'channel') {
          teamPolicy = tempPolicy
        } else {
          policy = tempPolicy
        }
      }
    }

    return {
      canSetPolicy: entityType === 'adhoc' || Constants.getCanPerformByID(state, teamID).setRetentionPolicy,
      entityType, // used only to display policy to non-admins
      loading,
      policy,
      policyIsExploding:
        policy.type === 'explode' || (policy.type === 'inherit' && teamPolicy?.type === 'explode'),
      showInheritOption: entityType === 'channel',
      showOverrideNotice: entityType === 'big team',
      teamPolicy,
    }
  },
  (dispatch, {conversationIDKey, entityType, teamID}: OwnProps) => ({
    _onShowWarning: (policy: RetentionPolicy, onConfirm: () => void, onCancel: () => void) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {entityType, onCancel, onConfirm, policy},
              selected: 'retentionWarning',
            },
          ],
        })
      )
    },
    saveRetentionPolicy: (policy: RetentionPolicy) => {
      if (['small team', 'big team'].includes(entityType)) {
        dispatch(TeamsGen.createSaveTeamRetentionPolicy({policy, teamID}))
      } else if (['adhoc', 'channel'].includes(entityType)) {
        // we couldn't get here without throwing an error for !conversationIDKey
        dispatch(createSetConvRetentionPolicy({conversationIDKey: conversationIDKey!, policy}))
      } else {
        throw new Error(`RetentionPicker: impossible entityType encountered: ${entityType}`)
      }
    },
  }),
  (s, d, o: OwnProps) => {
    const {_onShowWarning, ...dRest} = d
    const p: {
      entityType: RetentionEntityType
    } & Props = {
      ...o,
      ...s,
      ...dRest,
      onShowWarning: (policy: any, onConfirm: any, onCancel: any) =>
        _onShowWarning(policy, onConfirm, onCancel),
    }
    return p
  }
)(RetentionPicker)
