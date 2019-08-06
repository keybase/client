import * as React from 'react'
import {Task, TaskButton} from '.'
import * as PeopleGen from '../../actions/people-gen'
import * as Types from '../../constants/types/people'
import * as Tabs from '../../constants/tabs'
import * as SettingsTabs from '../../constants/settings'
import {IconType} from '../../common-adapters/icon.constants'
import {todoTypes} from '../../constants/people'
import {connect, isMobile} from '../../util/container'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as SettingsGen from '../../actions/settings-gen'
import openURL from '../../util/open-url'

type TodoOwnProps = {
  badged: boolean
  confirmLabel: string
  icon: IconType
  instructions: string
  metadata: Types.TodoMeta
  todoType: Types.TodoType
}

const installLinkURL = 'https://keybase.io/download'
const onSkipTodo = (type: Types.TodoType, dispatch) => () => dispatch(PeopleGen.createSkipTodo({type}))
const mapStateToProps = state => ({myUsername: state.config.username || ''})

function makeDefaultButtons(onConfirm, confirmLabel, onDismiss?, dismissLabel?) {
  const result = [
    {
      label: confirmLabel,
      onClick: onConfirm,
    },
  ] as Array<TaskButton>
  if (onDismiss) {
    result.push({
      label: dismissLabel || 'Later',
      mode: 'Secondary',
      onClick: onDismiss,
    })
  }
  return result
}

const AddEmailConnector = connect(
  mapStateToProps,
  dispatch => ({
    onConfirm: () => {
      dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
      dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.accountTab]}))
      dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddEmail']}))
    },
    onDismiss: onSkipTodo('addEmail', dispatch),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: makeDefaultButtons(d.onConfirm, o.confirmLabel, d.onDismiss),
  })
)(Task)

const AddPhoneNumberConnector = connect(
  mapStateToProps,
  dispatch => ({
    onConfirm: () => {
      dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
      dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.accountTab]}))
      dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddPhone']}))
    },
    onDismiss: onSkipTodo('addPhoneNumber', dispatch),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: makeDefaultButtons(d.onConfirm, o.confirmLabel, d.onDismiss),
  })
)(Task)

const AvatarTeamConnector = connect(
  mapStateToProps,
  dispatch => ({
    onConfirm: () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.teamsTab})),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: makeDefaultButtons(d.onConfirm, o.confirmLabel),
  })
)(Task)

const AvatarUserConnector = connect(
  mapStateToProps,
  dispatch => ({
    onConfirm: () => dispatch(ProfileGen.createEditAvatar()),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: makeDefaultButtons(d.onConfirm, o.confirmLabel),
  })
)(Task)

const BioConnector = connect(
  mapStateToProps,
  dispatch => ({
    _onConfirm: (username: string) => {
      // make sure we have tracker state & profile is up to date
      dispatch(Tracker2Gen.createShowUser({asTracker: false, username}))
    },
  }),
  (stateProps, dispatchProps, ownProps: TodoOwnProps) => ({
    ...ownProps,
    buttons: makeDefaultButtons(() => dispatchProps._onConfirm(stateProps.myUsername), ownProps.confirmLabel),
  })
)(Task)

const ProofConnector = connect(
  mapStateToProps,
  dispatch => ({
    _onConfirm: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
    onDismiss: onSkipTodo('proof', dispatch),
  }),
  (stateProps, dispatchProps, ownProps: TodoOwnProps) => ({
    ...ownProps,
    buttons: makeDefaultButtons(
      () => dispatchProps._onConfirm(stateProps.myUsername),
      ownProps.confirmLabel,
      dispatchProps.onDismiss
    ),
  })
)(Task)

const DeviceConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => openURL(installLinkURL),
    onDismiss: onSkipTodo('device', dispatch),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: makeDefaultButtons(d.onConfirm, o.confirmLabel, d.onDismiss),
  })
)(Task)

const FollowConnector = connect(
  () => ({}),
  dispatch => ({
    onDismiss: onSkipTodo('follow', dispatch),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: [
      {
        label: 'Follow later',
        mode: 'Secondary',
        onClick: d.onDismiss,
      },
    ] as Array<TaskButton>,
    showSearchBar: true,
  })
)(Task)

const ChatConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.chatTab})),
    onDismiss: onSkipTodo('chat', dispatch),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: makeDefaultButtons(d.onConfirm, o.confirmLabel, d.onDismiss),
  })
)(Task)

const PaperKeyConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {highlight: ['paper key']}, selected: 'deviceAdd'}],
        })
      ),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: makeDefaultButtons(d.onConfirm, o.confirmLabel),
  })
)(Task)

const TeamConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => {
      dispatch(RouteTreeGen.createNavigateAppend({path: ['teamNewTeamDialog']}))
      dispatch(RouteTreeGen.createNavigateAppend({path: [Tabs.teamsTab]}))
    },
    onDismiss: onSkipTodo('team', dispatch),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: makeDefaultButtons(d.onConfirm, o.confirmLabel, d.onDismiss),
  })
)(Task)

const FolderConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.fsTab})),
    onDismiss: onSkipTodo('folder', dispatch),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: makeDefaultButtons(d.onConfirm, o.confirmLabel, d.onDismiss),
  })
)(Task)

const GitRepoConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: (isTeam: boolean) => {
      if (isMobile) {
        dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.gitTab]}))
      } else {
        dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.gitTab}))
      }
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam}, selected: 'gitNewRepo'}]}))
    },
    onDismiss: onSkipTodo('gitRepo', dispatch),
  }),
  (_, dispatchProps, ownProps: TodoOwnProps) => ({
    ...ownProps,
    buttons: [
      {
        label: 'Create a personal repo',
        onClick: () => dispatchProps.onConfirm(false),
      },
      {
        label: 'Create a team repo',
        onClick: () => dispatchProps.onConfirm(true),
      },
      {
        label: 'Later',
        mode: 'Secondary',
        onClick: dispatchProps.onDismiss,
      },
    ] as Array<TaskButton>,
  })
)(Task)

const TeamShowcaseConnector = connect(
  () => ({}),
  dispatch => ({
    onConfirm: () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.teamsTab})),
    onDismiss: onSkipTodo('teamShowcase', dispatch),
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: makeDefaultButtons(d.onConfirm, o.confirmLabel, d.onDismiss),
  })
)(Task)

const VerifyAllEmailConnector = connect(
  state => ({...mapStateToProps(state), _addedEmail: state.settings.email.addedEmail}),
  dispatch => ({
    _onConfirm: email => {
      dispatch(SettingsGen.createEditEmail({email, verify: true}))
    },
    onManage: () => {
      dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
      dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.accountTab]}))
    },
  }),
  (s, d, o: TodoOwnProps) => {
    const meta = o.metadata
    return {
      ...o,
      buttons: [
        ...(meta && meta.type === 'email'
          ? [
              {
                label: 'Verify',
                onClick: () => d._onConfirm(meta.email),
                type: 'Success',
                waiting: s._addedEmail && s._addedEmail === meta.email,
              },
            ]
          : []),
        {
          label: 'Manage email',
          mode: 'Secondary',
          onClick: d.onManage,
        },
      ] as Array<TaskButton>,
    }
  }
)(Task)

const VerifyAllPhoneNumberConnector = connect(
  mapStateToProps,
  dispatch => ({
    _onConfirm: (phoneNumber: string) => {
      dispatch(SettingsGen.createResendVerificationForPhoneNumber({phoneNumber}))
      dispatch(RouteTreeGen.createNavigateAppend({path: ['settingsVerifyPhone']}))
    },
    onManage: () => {
      dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
      dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.accountTab]}))
    },
  }),
  (_, d, o: TodoOwnProps) => ({
    ...o,
    buttons: [
      ...(o.metadata
        ? [
            {
              label: 'Verify',
              onClick: () => {
                const meta = o.metadata
                meta && meta.type === 'phone' && d._onConfirm(meta.phone)
              },
              type: 'Success',
            },
          ]
        : []),
      {
        label: 'Manage numbers',
        mode: 'Secondary',
        onClick: d.onManage,
      },
    ] as Array<TaskButton>,
  })
)(Task)

const LegacyEmailVisibilityConnector = connect(
  mapStateToProps,
  dispatch => ({
    _onConfirm: email => {
      dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
      dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsTabs.accountTab]}))
      dispatch(SettingsGen.createEditEmail({email, makeSearchable: true}))
    },
    onDismiss: onSkipTodo('legacyEmailVisibility', dispatch),
  }),
  (_, dispatchProps, ownProps: TodoOwnProps) => ({
    ...ownProps,
    buttons: [
      ...(ownProps.metadata
        ? [
            {
              label: 'Make searchable',
              onClick: () => {
                const meta = ownProps.metadata
                meta && meta.type === 'email' && dispatchProps._onConfirm(meta.email)
              },
              type: 'Success',
            },
          ]
        : []),
      {
        label: 'No',
        mode: 'Secondary',
        onClick: dispatchProps.onDismiss,
      },
    ] as Array<TaskButton>,
    subText: 'Your email will never appear on your public profile.',
  })
)(Task)

const TaskChooser = (props: TodoOwnProps) => {
  switch (props.todoType) {
    case todoTypes.addEmail:
      return <AddEmailConnector {...props} />
    case todoTypes.addPhoneNumber:
      return <AddPhoneNumberConnector {...props} />
    case todoTypes.avatarTeam:
      return <AvatarTeamConnector {...props} />
    case todoTypes.avatarUser:
      return <AvatarUserConnector {...props} />
    case todoTypes.bio:
      return <BioConnector {...props} />
    case todoTypes.proof:
      return <ProofConnector {...props} />
    case todoTypes.device:
      return <DeviceConnector {...props} />
    case todoTypes.follow:
      return <FollowConnector {...props} />
    case todoTypes.chat:
      return <ChatConnector {...props} />
    case todoTypes.paperkey:
      return <PaperKeyConnector {...props} />
    case todoTypes.team:
      return <TeamConnector {...props} />
    case todoTypes.folder:
      return <FolderConnector {...props} />
    case todoTypes.gitRepo:
      return <GitRepoConnector {...props} />
    case todoTypes.legacyEmailVisibility:
      return <LegacyEmailVisibilityConnector {...props} />
    case todoTypes.teamShowcase:
      return <TeamShowcaseConnector {...props} />
    case todoTypes.verifyAllEmail:
      return <VerifyAllEmailConnector {...props} />
    case todoTypes.verifyAllPhoneNumber:
      return <VerifyAllPhoneNumberConnector {...props} />
  }
  return null
}

export default TaskChooser
