import * as C from '@/constants'
import type * as T from '@/constants/types'
import RetentionPicker, {type RetentionEntityType} from '.'
import type {StylesCrossPlatform} from '@/styles'

export type OwnProps = {
  conversationIDKey?: T.Chat.ConversationIDKey
  containerStyle?: StylesCrossPlatform
  dropdownStyle?: StylesCrossPlatform
  entityType: RetentionEntityType
  showSaveIndicator: boolean
  teamID: T.Teams.TeamID
}

const Container = (ownProps: OwnProps) => {
  const {entityType, conversationIDKey: _cid, teamID} = ownProps

  let loading = false
  let teamPolicy: T.Retention.RetentionPolicy | undefined

  if (_cid) {
  } else if (!entityType.endsWith('team')) {
    throw new Error(`RetentionPicker needs a conversationIDKey to set ${entityType} retention policies`)
  }
  const conversationIDKey = _cid ?? C.Chat.noConversationIDKey
  let policy = C.useConvoState(conversationIDKey, s =>
    _cid ? s.meta.retentionPolicy : C.Teams.retentionPolicies.policyRetain
  )
  const tempPolicy = C.useTeamsState(s => C.Teams.getTeamRetentionPolicyByID(s, teamID))
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
    s => entityType === 'adhoc' || C.Teams.getCanPerformByID(s, teamID).setRetentionPolicy
  )
  const policyIsExploding =
    policy.type === 'explode' || (policy.type === 'inherit' && teamPolicy?.type === 'explode')
  const showInheritOption = entityType === 'channel'
  const showOverrideNotice = entityType === 'big team'
  const setTeamRetentionPolicy = C.useTeamsState(s => s.dispatch.setTeamRetentionPolicy)
  const setConvRetentionPolicy = C.useConvoState(conversationIDKey, s => s.dispatch.setConvRetentionPolicy)
  const saveRetentionPolicy = (policy: T.Retention.RetentionPolicy) => {
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

export default Container
