import * as ConfigGen from '../../actions/config-gen'
import * as SettingsGen from '../../actions/settings-gen'
import * as WaitingGen from '../../actions/waiting-gen'
import type * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/settings'
import * as TeamConstants from '../../constants/teams'
import type * as TeamTypes from '../../constants/types/teams'

import Chat from '.'

type OwnProps = {}

const emptyList = []

export default Container.connect(
  state => {
    const contactSettingsEnabled = state.settings.chat.contactSettings.settings?.enabled
    const contactSettingsIndirectFollowees =
      state.settings.chat.contactSettings.settings?.allowFolloweeDegrees === 2
    const contactSettingsTeams = state.settings.chat.contactSettings.settings?.teams
    const contactSettingsTeamsEnabled = state.settings.chat.contactSettings.settings?.allowGoodTeams

    const whitelist = state.settings.chat.unfurl.unfurlWhitelist
    const unfurlWhitelist = whitelist ?? emptyList
    return {
      allowEdit: state.settings.notifications.allowEdit,
      contactSettingsEnabled,
      contactSettingsError: state.settings.chat.contactSettings.error,
      contactSettingsIndirectFollowees,
      contactSettingsTeams,
      contactSettingsTeamsEnabled,
      groups: state.settings.notifications.groups,
      mobileHasPermissions: state.push.hasPermissions,
      sound: state.config.notifySound, // desktop
      teamMeta: state.teams.teamMeta,
      unfurlError: state.settings.chat.unfurl.unfurlError,
      unfurlMode: state.settings.chat.unfurl.unfurlMode,
      unfurlWhitelist,
    }
  },
  dispatch => ({
    onBack: Container.isMobile ? () => dispatch(RouteTreeGen.createNavigateUp()) : undefined,
    onContactSettingsSave: (
      enabled: boolean,
      indirectFollowees: boolean,
      teamsEnabled: boolean,
      teamsList: {[k in TeamTypes.TeamID]: boolean}
    ) => {
      dispatch(SettingsGen.createContactSettingsSaved({enabled, indirectFollowees, teamsEnabled, teamsList}))
    },
    onRefresh: () => {
      // Security: misc
      dispatch(SettingsGen.createLoadSettings())
      dispatch(SettingsGen.createNotificationsRefresh())

      // Security: contact settings
      dispatch(WaitingGen.createIncrementWaiting({key: Constants.contactSettingsLoadWaitingKey}))
      dispatch(SettingsGen.createContactSettingsRefresh())
      dispatch(WaitingGen.createDecrementWaiting({key: Constants.contactSettingsLoadWaitingKey}))

      // Link previews
      dispatch(SettingsGen.createUnfurlSettingsRefresh())
    },
    onToggle: (group: string, name?: string) =>
      dispatch(SettingsGen.createNotificationsToggle({group, name})),
    onToggleSound: (notifySound: boolean) => dispatch(ConfigGen.createSetNotifySound({notifySound})),
    onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) => {
      dispatch(SettingsGen.createUnfurlSettingsSaved({mode, whitelist: whitelist}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const teamMeta = TeamConstants.sortTeamsByName(stateProps.teamMeta)
    const serverSelectedTeams = new Map(
      stateProps.contactSettingsTeams?.map(t => [t.teamID, {enabled: t.enabled}])
    )
    const selectedTeams: {[K in TeamTypes.TeamID]: boolean} = {}
    teamMeta.forEach(t => {
      if (serverSelectedTeams.has(t.id)) {
        // If there's a server-provided previous choice, use that.
        selectedTeams[t.id] = !!serverSelectedTeams.get(t.id)?.enabled
      } else {
        // Else, default the team to being selected if the team is non-open.
        selectedTeams[t.id] = !t.isOpen
      }
    })
    return {
      ...ownProps,
      ...stateProps,
      ...dispatchProps,
      contactSettingsSelectedTeams: selectedTeams,
      teamMeta,
    }
  }
)(Chat)
