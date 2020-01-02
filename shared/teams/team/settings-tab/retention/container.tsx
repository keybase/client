import * as Container from '../../../../util/container'
import * as Flow from '../../../../util/flow'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as TeamsGen from '../../../../actions/teams-gen'
import RetentionPicker, {RetentionEntityType} from '.'
import {ConversationIDKey} from '../../../../constants/types/chat2'
import {RetentionPolicy} from '../../../../constants/types/retention-policy'
import {StylesCrossPlatform} from '../../../../styles'
import {createSetConvRetentionPolicy} from '../../../../actions/chat2-gen'
import {getConversationRetentionPolicy} from '../../../../constants/chat2/meta'
import {getTeamRetentionPolicy, retentionPolicies, getCanPerform} from '../../../../constants/teams'

export type OwnProps = {
  conversationIDKey?: ConversationIDKey
  containerStyle?: StylesCrossPlatform
  dropdownStyle?: StylesCrossPlatform
  entityType: RetentionEntityType
  showSaveIndicator: boolean
  teamname?: string
  type: 'simple' | 'auto'
  onSelect?: (policy: RetentionPolicy, changed: boolean, decreased: boolean) => void
}

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    let policy: RetentionPolicy = retentionPolicies.policyRetain
    let teamPolicy: RetentionPolicy | undefined = undefined
    let showInheritOption = false
    let showOverrideNotice = false
    let loading = false
    const entityType = ownProps.entityType
    let canSetPolicy = true
    let yourOperations
    switch (entityType) {
      case 'adhoc':
        if (ownProps.conversationIDKey) {
          policy = getConversationRetentionPolicy(state, ownProps.conversationIDKey)
          showInheritOption = false
          showOverrideNotice = false
          break
        }
        throw new Error('RetentionPicker needs a conversationIDKey to set adhoc retention policies')
      case 'channel':
        if (ownProps.conversationIDKey && ownProps.teamname) {
          const teamname = ownProps.teamname
          const conversationIDKey = ownProps.conversationIDKey
          policy = getConversationRetentionPolicy(state, conversationIDKey)
          teamPolicy = getTeamRetentionPolicy(state, teamname) ?? undefined
          loading = !teamPolicy
          yourOperations = getCanPerform(state, teamname)
          canSetPolicy = yourOperations.setRetentionPolicy
          showInheritOption = true
          showOverrideNotice = false
          break
        }
        throw new Error(
          'RetentionPicker needs a conversationIDKey AND teamname to set channel retention policies'
        )
      case 'small team':
        if (ownProps.teamname) {
          const teamname = ownProps.teamname
          yourOperations = getCanPerform(state, teamname)
          canSetPolicy = yourOperations.setRetentionPolicy
          const tempPolicy = getTeamRetentionPolicy(state, teamname)
          loading = !tempPolicy
          if (tempPolicy) {
            policy = tempPolicy
          }
          showInheritOption = false
          showOverrideNotice = false
          break
        }
        throw new Error('RetentionPicker needs a teamname to set small team retention policies')
      case 'big team':
        if (ownProps.teamname) {
          const teamname = ownProps.teamname
          yourOperations = getCanPerform(state, teamname)
          canSetPolicy = yourOperations.setRetentionPolicy
          const tempPolicy = getTeamRetentionPolicy(state, teamname)
          loading = !tempPolicy
          if (tempPolicy) {
            policy = tempPolicy
          }
          showInheritOption = false
          showOverrideNotice = true
          break
        }
        throw new Error('RetentionPicker needs a teamname to set big team retention policies')
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(entityType)
      // Issue with flow here: https://github.com/facebook/flow/issues/6068
      // throw new Error(`RetentionPicker: impossible entityType encountered: ${entityType}`)
    }

    if (!['adhoc', 'channel', 'small team', 'big team'].includes(entityType)) {
      throw new Error(`RetentionPicker: impossible entityType encountered: ${entityType}`)
    }

    const policyIsExploding =
      policy.type === 'explode' || (policy.type === 'inherit' && teamPolicy?.type === 'explode')
    return {
      canSetPolicy,
      entityType, // used only to display policy to non-admins
      loading,
      policy,
      policyIsExploding,
      showInheritOption,
      showOverrideNotice,
      teamPolicy,
    }
  },
  (dispatch, {conversationIDKey, entityType, teamname}: OwnProps) => ({
    _loadTeamPolicy: () => teamname && dispatch(TeamsGen.createGetTeamRetentionPolicy({teamname})),
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
        // we couldn't get here without throwing an error for !teamname
        teamname && dispatch(TeamsGen.createSaveTeamRetentionPolicy({policy, teamname}))
      } else if (['adhoc', 'channel'].includes(entityType)) {
        // we couldn't get here without throwing an error for !conversationIDKey
        conversationIDKey && dispatch(createSetConvRetentionPolicy({conversationIDKey, policy}))
      } else {
        throw new Error(`RetentionPicker: impossible entityType encountered: ${entityType}`)
      }
    },
  }),
  (s, d, o: OwnProps) => {
    const {_loadTeamPolicy, _onShowWarning, ...dRest} = d
    return {
      ...o,
      ...s,
      ...dRest,
      load: () => _loadTeamPolicy(),
      onShowWarning: (policy: any, onConfirm: any, onCancel: any) =>
        _onShowWarning(policy, onConfirm, onCancel),
    }
  },
  'RetentionPicker'
)(RetentionPicker)
