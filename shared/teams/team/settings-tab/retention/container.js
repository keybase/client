// @flow
import * as TeamsGen from '../../../../actions/teams-gen'
import {createSetConvRetentionPolicy} from '../../../../actions/chat2-gen'
import {namedConnect, compose, lifecycle, withStateHandlers, withHandlers} from '../../../../util/container'
import {
  getTeamRetentionPolicy,
  retentionPolicies,
  getCanPerform,
  hasCanPerform,
} from '../../../../constants/teams'
import {getConversationRetentionPolicy} from '../../../../constants/chat2/meta'
import type {RetentionPolicy} from '../../../../constants/types/retention-policy'
import {navigateTo, pathSelector} from '../../../../actions/route-tree'
import {type Path} from '../../../../route-tree'
import type {ConversationIDKey} from '../../../../constants/types/chat2'
import type {StylesCrossPlatform} from '../../../../styles'
import RetentionPicker, {type RetentionEntityType} from './'

export type OwnProps = {
  conversationIDKey?: ConversationIDKey,
  containerStyle?: StylesCrossPlatform,
  dropdownStyle?: StylesCrossPlatform,
  entityType: RetentionEntityType,
  showSaveIndicator: boolean,
  teamname?: string,
  type: 'simple' | 'auto',
  onSelect?: (policy: RetentionPolicy, changed: boolean, decreased: boolean) => void,
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  let policy: RetentionPolicy = retentionPolicies.policyRetain
  let teamPolicy: ?RetentionPolicy
  let showInheritOption = false
  let showOverrideNotice = false
  let loading = false
  let entityType = ownProps.entityType
  let canSetPolicy = true
  let yourOperations
  let _permissionsLoaded = true
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
        teamPolicy = getTeamRetentionPolicy(state, teamname)
        loading = !teamPolicy
        yourOperations = getCanPerform(state, teamname)
        _permissionsLoaded = hasCanPerform(state, teamname)
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
        _permissionsLoaded = hasCanPerform(state, teamname)
        canSetPolicy = yourOperations.setRetentionPolicy
        const tempPolicy = getTeamRetentionPolicy(state, teamname)
        loading = !(tempPolicy && _permissionsLoaded)
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
        _permissionsLoaded = hasCanPerform(state, teamname)
        canSetPolicy = yourOperations.setRetentionPolicy
        const tempPolicy = getTeamRetentionPolicy(state, teamname)
        loading = !(tempPolicy && _permissionsLoaded)
        if (tempPolicy) {
          policy = tempPolicy
        }
        showInheritOption = false
        showOverrideNotice = true
        break
      }
      throw new Error('RetentionPicker needs a teamname to set big team retention policies')
    default:
    /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(entityType);
      */
    // Issue with flow here: https://github.com/facebook/flow/issues/6068
    // throw new Error(`RetentionPicker: impossible entityType encountered: ${entityType}`)
  }

  if (!['adhoc', 'channel', 'small team', 'big team'].includes(entityType)) {
    throw new Error(`RetentionPicker: impossible entityType encountered: ${entityType}`)
  }

  const _path = pathSelector(state)
  return {
    _path,
    _permissionsLoaded,
    canSetPolicy,
    entityType, // used only to display policy to non-admins
    loading,
    policy,
    showInheritOption,
    showOverrideNotice,
    teamPolicy,
  }
}

const mapDispatchToProps = (
  dispatch,
  {conversationIDKey, entityType, teamname, onSelect, type}: OwnProps
) => ({
  _loadTeamPolicy: () => teamname && dispatch(TeamsGen.createGetTeamRetentionPolicy({teamname})),
  _loadTeamOperations: () => teamname && dispatch(TeamsGen.createGetTeamOperations({teamname})),
  _onShowWarning: (days: number, onConfirm: () => void, onCancel: () => void, parentPath: Path) => {
    dispatch(
      navigateTo(
        [
          {
            selected: 'retentionWarning',
            props: {days, onCancel, onConfirm, entityType},
          },
        ],
        parentPath
      )
    )
  },
  saveRetentionPolicy: (policy: RetentionPolicy) => {
    if (['small team', 'big team'].includes(entityType)) {
      // we couldn't get here without throwing an error for !teamname
      teamname && dispatch(TeamsGen.createSaveTeamRetentionPolicy({policy, teamname}))
    } else if (['adhoc', 'channel'].includes(entityType)) {
      // we couldn't get here without throwing an error for !conversationIDKey
      conversationIDKey && dispatch(createSetConvRetentionPolicy({policy, conversationIDKey}))
    } else {
      throw new Error(`RetentionPicker: impossible entityType encountered: ${entityType}`)
    }
  },
})

export default compose(
  namedConnect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d}),
    'RetentionPicker'
  ),
  withStateHandlers({_parentPath: null}, {_setParentPath: () => _parentPath => ({_parentPath})}),
  lifecycle({
    componentDidMount() {
      this.props._setParentPath(this.props._path)
      this.props._loadTeamPolicy()
      !this.props._permissionsLoaded && this.props._loadTeamOperations()
    },
  }),
  withHandlers({
    onShowWarning: ({_parentPath, _onShowWarning}) => (days, onConfirm, onCancel) =>
      _onShowWarning(days, onConfirm, onCancel, _parentPath),
  })
)(RetentionPicker)
