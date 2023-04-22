import * as Constants from '../../../../constants/teams'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as TeamsGen from '../../../../actions/teams-gen'
import type * as TeamsTypes from '../../../../constants/types/teams'
import RetentionPicker, {type RetentionEntityType} from '.'
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

export default (ownProps: OwnProps) => {
  const {entityType, conversationIDKey, teamID} = ownProps

  let loading = false
  let teamPolicy: RetentionPolicy | undefined = undefined

  let policy = Container.useSelector(state =>
    conversationIDKey ? getConversationRetentionPolicy(state, conversationIDKey) : undefined
  )
  if (ownProps.conversationIDKey) {
  } else if (!entityType.endsWith('team')) {
    throw new Error(`RetentionPicker needs a conversationIDKey to set ${entityType} retention policies`)
  }
  const tempPolicy = Container.useSelector(state => Constants.getTeamRetentionPolicyByID(state, teamID))
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

  const canSetPolicy = Container.useSelector(
    state => entityType === 'adhoc' || Constants.getCanPerformByID(state, teamID).setRetentionPolicy
  )
  if (!policy) return null
  const policyIsExploding =
    policy.type === 'explode' || (policy.type === 'inherit' && teamPolicy?.type === 'explode')
  const showInheritOption = entityType === 'channel'
  const showOverrideNotice = entityType === 'big team'
  const dispatch = Container.useDispatch()
  const _onShowWarning = (policy: RetentionPolicy, onConfirm: () => void, onCancel: () => void) => {
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
  }
  const saveRetentionPolicy = (policy: RetentionPolicy) => {
    if (['small team', 'big team'].includes(entityType)) {
      dispatch(TeamsGen.createSaveTeamRetentionPolicy({policy, teamID}))
    } else if (['adhoc', 'channel'].includes(entityType)) {
      // we couldn't get here without throwing an error for !conversationIDKey
      dispatch(createSetConvRetentionPolicy({conversationIDKey: conversationIDKey!, policy}))
    } else {
      throw new Error(`RetentionPicker: impossible entityType encountered: ${entityType}`)
    }
  }
  const props = {
    canSetPolicy,
    entityType,
    loading,
    onShowWarning: (policy: any, onConfirm: any, onCancel: any) =>
      _onShowWarning(policy, onConfirm, onCancel),
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
