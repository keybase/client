import * as SettingsGen from '../../actions/settings-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamConstants from '../../constants/teams'
import Chat from '.'

type OwnProps = {}

const emptyList = []

const Connector = Container.namedConnect(
  state => {
    const contactSettingsEnabled = state.settings.chat.contactSettings.settings?.enabled
    const contactSettingsIndirectFollowees =
      state.settings.chat.contactSettings.settings?.allowFolloweeDegrees === 2
    const contactSettingsTeams = state.settings.chat.contactSettings.settings?.teams
    const whitelist = state.settings.chat.unfurl.unfurlWhitelist
    const unfurlWhitelist = whitelist ?? emptyList
    console.warn('contactSettingsTeams is', contactSettingsTeams)
    return {
      contactSettingsEnabled,
      contactSettingsIndirectFollowees,
      contactSettingsTeams,
      teamDetails: state.teams.teamDetails,
      title: 'Chat',
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
      teamsList: {[k in string]: boolean}
    ) => {
      dispatch(SettingsGen.createContactSettingsSaved({enabled, indirectFollowees, teamsEnabled, teamsList}))
    },
    onRefresh: () => {
      dispatch(SettingsGen.createContactSettingsRefresh())
      dispatch(SettingsGen.createUnfurlSettingsRefresh())
    },
    onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) => {
      dispatch(SettingsGen.createUnfurlSettingsSaved({mode, whitelist: whitelist}))
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const teamDetails = TeamConstants.sortTeamsByName(stateProps.teamDetails)
    const serverSelectedTeams = new Map(
      stateProps.contactSettingsTeams?.map(t => [t.teamID, {enabled: t.enabled}])
    )
    const selectedTeams: {[K in string]: boolean} = {}
    teamDetails.forEach(t => {
      // Default to selected if the team is non-open.
      // But if there's a server-provided choice, use that instead.
      if (serverSelectedTeams.has(t.id)) {
        selectedTeams[t.id] = !!serverSelectedTeams.get(t.id)?.enabled
      }
      // Else, default to selected if the team is non-open.
      selectedTeams[t.id] = !t.isOpen
    })
    return {
      ...ownProps,
      ...stateProps,
      ...dispatchProps,
      contactSettingsSelectedTeams: selectedTeams,
      teamDetails,
    }
  },
  'Chat'
)(Chat)

export default Connector
