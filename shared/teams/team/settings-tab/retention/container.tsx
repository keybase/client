import * as C from '../../../../constants'
import * as Constants from '../../../../constants/teams'
import type * as TeamsTypes from '../../../../constants/types/teams'
import RetentionPicker, {type RetentionEntityType} from '.'
import type {ConversationIDKey} from '../../../../constants/types/chat2'
import type {RetentionPolicy} from '../../../../constants/types/retention-policy'
import type {StylesCrossPlatform} from '../../../../styles'

export type OwnProps = {
  conversationIDKey?: ConversationIDKey
  containerStyle?: StylesCrossPlatform
  dropdownStyle?: StylesCrossPlatform
  entityType: RetentionEntityType
  showSaveIndicator: boolean
  teamID: TeamsTypes.TeamID
}

export default (ownProps: OwnProps) => {
  const {entityType, conversationIDKey: _cid, teamID} = ownProps

  let loading = false
  let teamPolicy: RetentionPolicy | undefined = undefined

  if (_cid) {
  } else if (!entityType.endsWith('team')) {
    throw new Error(`RetentionPicker needs a conversationIDKey to set ${entityType} retention policies`)
  }
  const conversationIDKey = _cid ?? C.noConversationIDKey
  let policy = C.useConvoState(conversationIDKey, s =>
    _cid ? s.meta.retentionPolicy : Constants.retentionPolicies.policyRetain
  )
  const tempPolicy = C.useTeamsState(s => Constants.getTeamRetentionPolicyByID(s, teamID))
  if (entityType !== 'adhoc') {
    loading = !tempPolicy
    if (tempPolicy) {
      if (entityType === 'channel') {
        teamPolicy = tempPolicy
      } else {
        policy = tempPolicy
      }
    }
  }

  const canSetPolicy = C.useTeamsState(
    s => entityType === 'adhoc' || Constants.getCanPerformByID(s, teamID).setRetentionPolicy
  )
  const policyIsExploding =
    policy.type === 'explode' || (policy.type === 'inherit' && teamPolicy?.type === 'explode')
  const showInheritOption = entityType === 'channel'
  const showOverrideNotice = entityType === 'big team'
  const setTeamRetentionPolicy = C.useTeamsState(s => s.dispatch.setTeamRetentionPolicy)
  const setConvRetentionPolicy = C.useConvoState(conversationIDKey, s => s.dispatch.setConvRetentionPolicy)
  const saveRetentionPolicy = (policy: RetentionPolicy) => {
    if (['small team', 'big team'].includes(entityType)) {
      setTeamRetentionPolicy(teamID, policy)
    } else if (['adhoc', 'channel'].includes(entityType)) {
      // we couldn't get here without throwing an error for !conversationIDKey
      setConvRetentionPolicy(policy)
    } else {
      throw new Error(`RetentionPicker: impossible entityType encountered: ${entityType}`)
    }
  }
  const props = {
    canSetPolicy,
    entityType,
    loading,
    policy,
    policyIsExploding,
    saveRetentionPolicy,
    showInheritOption,
    showOverrideNotice,
    showSaveIndicator: ownProps.showSaveIndicator,
    teamID,
    teamPolicy,
  }
  return <RetentionPicker {...props} />
}
