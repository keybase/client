// @flow
import * as TeamsGen from '../../../../actions/teams-gen'
import {createSetConvRetentionPolicy} from '../../../../actions/chat2-gen'
import {
  connect,
  compose,
  lifecycle,
  setDisplayName,
  withStateHandlers,
  withHandlers,
  type TypedState,
} from '../../../../util/container'
import {getTeamRetentionPolicy} from '../../../../constants/teams'
import {getConversationRetentionPolicy} from '../../../../constants/chat2/meta'
import {type RetentionPolicy} from '../../../../constants/types/teams'
import {navigateTo, pathSelector} from '../../../../actions/route-tree'
import {type Path} from '../../../../route-tree'
import type {ConversationIDKey} from '../../../../constants/types/chat2'
import RetentionPicker from './'

// TODO make this typing tighter to guarantee the team properties if `isTeam` is true
// and we should also derive some of these props (isSmallTeam, )
export type OwnProps = {
  conversationIDKey?: ConversationIDKey,
  teamname?: string,
  isTeamWide?: boolean,
  isSmallTeam?: boolean,
  type: 'simple' | 'auto',
  onSelect?: (policy: RetentionPolicy, changed: boolean, decreased: boolean) => void,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const isTeam = !!ownProps.teamname
  const teamPolicy = isTeam && getTeamRetentionPolicy(state, ownProps.teamname)
  // we need to show a spinner, but only if it's a team
  const loading = isTeam && !teamPolicy
  if (!isTeam && !ownProps.conversationIDKey) {
    throw new Error('RetentionPicker got no conversationIDKey for ad-hoc conversation!')
  }
  const policy = getConversationRetentionPolicy(state, ownProps.conversationIDKey)
  if (!ownProps.isTeamWide && !policy) {
    throw new Error('Conv retpolicy not present in metaMap')
  }
  const _path = pathSelector(state)
  return {
    _path,
    policy: ownProps.isTeamWide ? teamPolicy : policy,
    isTeam,
    loading,
    teamPolicy: ownProps.isTeamWide ? undefined : teamPolicy,
  }
}

const mapDispatchToProps = (
  dispatch: Dispatch,
  {conversationIDKey, teamname, onSelect, type, isTeamWide, isSmallTeam}: OwnProps
) => ({
  _loadTeamPolicy: () => teamname && dispatch(TeamsGen.createGetTeamRetentionPolicy({teamname})),
  _onShowDropdown: (items, target, parentPath: Path) =>
    dispatch(
      navigateTo(
        [
          {
            selected: 'retentionDropdown',
            props: {items, position: 'top center', targetRect: target && target.getBoundingClientRect()},
          },
        ],
        parentPath
      )
    ),
  _onShowWarning: (days: number, onConfirm: () => void, onCancel: () => void, parentPath: Path) => {
    dispatch(
      navigateTo(
        [
          {
            selected: 'retentionWarning',
            props: {days, onCancel, onConfirm, isTeamWide, isTeam: !!teamname, isSmallTeam},
          },
        ],
        parentPath
      )
    )
  },
  setRetentionPolicy: (policy: RetentionPolicy) => {
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
  setDisplayName('RetentionPicker'),
  withStateHandlers({_parentPath: null}, {_setParentPath: () => _parentPath => ({_parentPath})}),
  lifecycle({
    componentWillMount: function() {
      this.props._setParentPath(this.props._path)
    },
    componentDidMount: function() {
      this.props._loadTeamPolicy()
    },
  }),
  withHandlers({
    onShowDropdown: ({_parentPath, _onShowDropdown}) => (items, target) =>
      _onShowDropdown(items, target, _parentPath),
    onShowWarning: ({_parentPath, _onShowWarning}) => (days, onConfirm, onCancel) =>
      _onShowWarning(days, onConfirm, onCancel, _parentPath),
  })
)(RetentionPicker)
