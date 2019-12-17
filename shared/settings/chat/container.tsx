import * as SettingsGen from '../../actions/settings-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as TeamConstants from '../../constants/teams'
import Chat from '.'

type OwnProps = {}

const emptyList = []

export default Container.namedConnect(
  state => {
    const contactSettingsEnabled = state.settings.chat.contactSettings.settings?.enabled
    const contactSettingsDirectFollowees =
      state.settings.chat.contactSettings.settings?.allowFolloweeDegrees === 1 ||
      state.settings.chat.contactSettings.settings?.allowFolloweeDegrees === 2
    const contactSettingsIndirectFollowees =
      state.settings.chat.contactSettings.settings?.allowFolloweeDegrees === 2
    const whitelist = state.settings.chat.unfurl.unfurlWhitelist
    const unfurlWhitelist = whitelist ?? emptyList
    return {
      contactSettingsDirectFollowees,
      contactSettingsEnabled,
      contactSettingsIndirectFollowees,
      teamDetails: state.teams.teamDetails,
      title: 'Chat',
      unfurlError: state.settings.chat.unfurl.unfurlError,
      unfurlMode: state.settings.chat.unfurl.unfurlMode,
      unfurlWhitelist,
    }
  },
  dispatch => ({
    onBack: Container.isMobile ? () => dispatch(RouteTreeGen.createNavigateUp()) : undefined,
    onContactSettingSave: () => {},
    onRefresh: () => {
      dispatch(SettingsGen.createContactSettingsRefresh())
      dispatch(SettingsGen.createUnfurlSettingsRefresh())
    },
    onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) =>
      dispatch(SettingsGen.createUnfurlSettingsSaved({mode, whitelist: whitelist})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d, teams: TeamConstants.sortTeamsByName(s.teamDetails)}),
  'Chat'
)(Chat)
