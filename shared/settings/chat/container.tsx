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

const emptyList = []

export default () => {
  const contactSettingsEnabled = Container.useSelector(
    state => state.settings.chat.contactSettings.settings?.enabled
  )
  const contactSettingsIndirectFollowees = Container.useSelector(
    state => state.settings.chat.contactSettings.settings?.allowFolloweeDegrees === 2
  )
  const contactSettingsTeams = Container.useSelector(
    state => state.settings.chat.contactSettings.settings?.teams
  )
  const contactSettingsTeamsEnabled = Container.useSelector(
    state => state.settings.chat.contactSettings.settings?.allowGoodTeams
  )
  const whitelist = Container.useSelector(state => state.settings.chat.unfurl.unfurlWhitelist)
  const unfurlWhitelist = whitelist ?? emptyList
  const allowEdit = Container.useSelector(state => state.settings.notifications.allowEdit)
  const contactSettingsError = Container.useSelector(state => state.settings.chat.contactSettings.error)
  const groups = Container.useSelector(state => state.settings.notifications.groups)
  const mobileHasPermissions = Container.useSelector(state => state.push.hasPermissions)
  const sound = Container.useSelector(state => state.config.notifySound) // desktop
  const _teamMeta = Container.useSelector(state => state.teams.teamMeta)
  const unfurlError = Container.useSelector(state => state.settings.chat.unfurl.unfurlError)
  const unfurlMode = Container.useSelector(state => state.settings.chat.unfurl.unfurlMode)

  const dispatch = Container.useDispatch()
  const onBack = Container.isMobile
    ? () => {
        dispatch(RouteTreeGen.createNavigateUp())
      }
    : undefined
  const onContactSettingsSave = (
    enabled: boolean,
    indirectFollowees: boolean,
    teamsEnabled: boolean,
    teamsList: {[k in TeamTypes.TeamID]: boolean}
  ) => {
    dispatch(SettingsGen.createContactSettingsSaved({enabled, indirectFollowees, teamsEnabled, teamsList}))
  }
  const onRefresh = () => {
    // Security: misc
    dispatch(SettingsGen.createLoadSettings())
    dispatch(SettingsGen.createNotificationsRefresh())

    // Security: contact settings
    dispatch(WaitingGen.createIncrementWaiting({key: Constants.contactSettingsLoadWaitingKey}))
    dispatch(SettingsGen.createContactSettingsRefresh())
    dispatch(WaitingGen.createDecrementWaiting({key: Constants.contactSettingsLoadWaitingKey}))

    // Link previews
    dispatch(SettingsGen.createUnfurlSettingsRefresh())
  }
  const onToggle = (group: string, name?: string) => {
    dispatch(SettingsGen.createNotificationsToggle({group, name}))
  }
  const onToggleSound = (notifySound: boolean) => {
    dispatch(ConfigGen.createSetNotifySound({notifySound}))
  }
  const onUnfurlSave = (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) => {
    dispatch(SettingsGen.createUnfurlSettingsSaved({mode, whitelist: whitelist}))
  }

  const teamMeta = TeamConstants.sortTeamsByName(_teamMeta)
  const serverSelectedTeams = new Map(contactSettingsTeams?.map(t => [t.teamID, {enabled: t.enabled}]))
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
  const props = {
    allowEdit,
    contactSettingsEnabled,
    contactSettingsError,
    contactSettingsIndirectFollowees,
    contactSettingsSelectedTeams: selectedTeams,
    contactSettingsTeamsEnabled,
    groups,
    mobileHasPermissions,
    onBack,
    onContactSettingsSave,
    onRefresh,
    onToggle,
    onToggleSound,
    onUnfurlSave,
    sound,
    teamMeta,
    unfurlError,
    unfurlMode,
    unfurlWhitelist,
  }
  return <Chat {...props} />
}
