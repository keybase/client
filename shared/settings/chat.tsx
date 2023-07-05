import * as Constants from '../constants/settings'
import * as ConfigConstants from '../constants/config'
import * as PushConstants from '../constants/push'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Platform from '../constants/platform'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Styles from '../styles'
import * as TeamConstants from '../constants/teams'
import type * as TeamTypes from '../constants/types/teams'
import type * as Types from '../constants/types/settings'
import type {TeamMeta, TeamID} from '../constants/types/teams'
import {Group} from './notifications/render'

const emptyList = new Array<string>()

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
  const mobileHasPermissions = PushConstants.useState(s => s.hasPermissions)
  const sound = ConfigConstants.useConfigState(s => s.notifySound) // desktop
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
    dispatch(SettingsGen.createContactSettingsRefresh())

    // Link previews
    dispatch(SettingsGen.createUnfurlSettingsRefresh())
  }
  const onToggle = (group: string, name?: string) => {
    dispatch(SettingsGen.createNotificationsToggle({group, name}))
  }
  const onToggleSound = ConfigConstants.useConfigState(s => s.dispatch.setNotifySound)

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

export type Props = {
  allowEdit: boolean
  contactSettingsEnabled?: boolean
  contactSettingsError: string
  contactSettingsIndirectFollowees?: boolean
  contactSettingsTeamsEnabled?: boolean
  contactSettingsSelectedTeams: {[K in TeamID]: boolean}
  groups: Map<string, Types.NotificationsGroupState>
  sound: boolean
  unfurlMode?: RPCChatTypes.UnfurlMode
  unfurlWhitelist?: Array<string>
  unfurlError?: string
  onBack?: () => void
  onContactSettingsSave: (
    enabled: boolean,
    indirectFollowees: boolean,
    teamsEnabled: boolean,
    teamsList: {[k in TeamID]: boolean}
  ) => void
  onToggle: (groupName: string, name: string) => void
  onToggleSound: (notifySound: boolean) => void
  onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) => void
  onRefresh: () => void
  teamMeta: Array<TeamMeta>
}

type State = {
  contactSettingsEnabled?: boolean
  contactSettingsIndirectFollowees?: boolean
  contactSettingsSelectedTeams: {[K in TeamID]: boolean}
  contactSettingsTeamsEnabled?: boolean
  unfurlSelected?: RPCChatTypes.UnfurlMode
  unfurlWhitelistRemoved: {[K in string]: boolean}
}

class Chat extends React.Component<Props, State> {
  state = {
    contactSettingsEnabled: undefined,
    contactSettingsIndirectFollowees: undefined,
    contactSettingsSelectedTeams: {},
    contactSettingsTeamsEnabled: undefined,
    unfurlSelected: undefined,
    unfurlWhitelistRemoved: {},
  }
  _isUnfurlModeSelected() {
    return this.state.unfurlSelected !== undefined && this.state.unfurlSelected !== this.props.unfurlMode
  }
  _isUnfurlWhitelistChanged() {
    return (
      Object.keys(this.state.unfurlWhitelistRemoved).filter(
        // @ts-ignore
        d => this.state.unfurlWhitelistRemoved[d]
      ).length > 0
    )
  }
  _getUnfurlMode() {
    const unfurlSelected = this.state.unfurlSelected
    if (unfurlSelected !== undefined) {
      return unfurlSelected
    }

    const unfurlMode = this.props.unfurlMode
    if (unfurlMode !== undefined) {
      return unfurlMode
    }
    return RPCChatTypes.UnfurlMode.whitelisted
  }
  _getUnfurlWhitelist(filtered: boolean) {
    return filtered
      ? // @ts-ignore
        (this.props.unfurlWhitelist || []).filter(w => !this.state.unfurlWhitelistRemoved[w])
      : this.props.unfurlWhitelist || []
  }
  _setUnfurlMode(mode: RPCChatTypes.UnfurlMode) {
    this.setState({unfurlSelected: mode})
  }
  _toggleUnfurlWhitelist(domain: string) {
    this.setState(s => ({
      unfurlWhitelistRemoved: {
        ...s.unfurlWhitelistRemoved,
        [domain]: !s.unfurlWhitelistRemoved[domain],
      },
    }))
  }
  _isUnfurlWhitelistRemoved(domain: string) {
    // @ts-ignore
    return this.state.unfurlWhitelistRemoved[domain]
  }
  _isUnfurlSaveDisabled() {
    return (
      this.props.unfurlMode === undefined ||
      (!this._isUnfurlModeSelected() && !this._isUnfurlWhitelistChanged())
    )
  }

  componentDidMount() {
    this.props.onRefresh()
    // If we're in storybook, trigger componentDidUpdate manually, otherwise it
    // won't run to copy props into state.
    __STORYBOOK__ && this.setState({contactSettingsEnabled: this.props.contactSettingsEnabled})
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.contactSettingsEnabled !== prevProps.contactSettingsEnabled ||
      (this.props.contactSettingsEnabled !== undefined && this.state.contactSettingsEnabled == undefined)
    ) {
      this.setState({contactSettingsEnabled: this.props.contactSettingsEnabled})
    }
    if (
      this.props.contactSettingsIndirectFollowees !== prevProps.contactSettingsIndirectFollowees ||
      (this.props.contactSettingsIndirectFollowees !== undefined &&
        this.state.contactSettingsIndirectFollowees == undefined)
    ) {
      this.setState({contactSettingsIndirectFollowees: this.props.contactSettingsIndirectFollowees})
    }
    if (
      this.props.contactSettingsTeamsEnabled !== prevProps.contactSettingsTeamsEnabled ||
      (this.props.contactSettingsTeamsEnabled !== undefined &&
        this.state.contactSettingsTeamsEnabled == undefined)
    ) {
      this.setState({contactSettingsTeamsEnabled: this.props.contactSettingsTeamsEnabled})
    }
    // Create an initial copy of teams data into state, so it can be mutated there.
    if (
      Object.keys(this.props.contactSettingsSelectedTeams).length > 0 &&
      Object.keys(this.state.contactSettingsSelectedTeams).length == 0
    ) {
      this.setState({contactSettingsSelectedTeams: this.props.contactSettingsSelectedTeams})
    }
  }

  render() {
    const showDesktopSound = !Platform.isMobile && !Platform.isLinux
    const showMobileSound = !!this.props.groups.get('sound')?.settings.length
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.ScrollView>
          <Kb.Box2 direction="vertical" fullHeight={true} gap="tiny" style={styles.container}>
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.innerContainer}>
              <Kb.Text type="Header">Security</Kb.Text>
            </Kb.Box2>

            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.innerContainer}>
              {!!this.props.groups.get('security')?.settings && (
                <Group
                  allowEdit={this.props.allowEdit}
                  groupName="security"
                  onToggle={this.props.onToggle}
                  settings={this.props.groups.get('security')!.settings}
                  unsubscribedFromAll={false}
                />
              )}

              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Checkbox
                  label="Only let someone message you or add you to a team if..."
                  onCheck={() =>
                    this.setState(prevState => ({contactSettingsEnabled: !prevState.contactSettingsEnabled}))
                  }
                  checked={!!this.state.contactSettingsEnabled}
                  disabled={this.props.contactSettingsEnabled === undefined}
                />
                {!!this.state.contactSettingsEnabled && (
                  <>
                    <Kb.Box2
                      direction="vertical"
                      fullWidth={true}
                      gap={Styles.isMobile ? 'small' : undefined}
                      gapStart={Styles.isMobile}
                      style={styles.checkboxIndented}
                    >
                      <Kb.Checkbox label="You follow them, or..." checked={true} disabled={true} />
                      <Kb.Checkbox
                        label="You follow someone who follows them, or..."
                        onCheck={checked =>
                          this.setState({
                            contactSettingsIndirectFollowees: checked,
                          })
                        }
                        checked={!!this.state.contactSettingsIndirectFollowees}
                      />
                      <Kb.Checkbox
                        label="They're in one of these teams with you:"
                        onCheck={checked => this.setState({contactSettingsTeamsEnabled: checked})}
                        checked={!!this.state.contactSettingsTeamsEnabled}
                        disabled={false}
                      />
                    </Kb.Box2>

                    {this.state.contactSettingsTeamsEnabled && (
                      <Kb.Box2
                        direction="vertical"
                        fullWidth={true}
                        gap={Styles.isMobile ? 'small' : undefined}
                        gapStart={false}
                        gapEnd={true}
                      >
                        {this.props.teamMeta.map(teamMeta => (
                          <TeamRow
                            // @ts-ignore
                            checked={this.state.contactSettingsSelectedTeams[teamMeta.id]}
                            key={teamMeta.id}
                            isOpen={teamMeta.isOpen}
                            name={teamMeta.teamname}
                            onCheck={(checked: boolean) =>
                              this.setState(prevState => ({
                                contactSettingsSelectedTeams: {
                                  ...prevState.contactSettingsSelectedTeams,
                                  [teamMeta.id]: checked,
                                },
                              }))
                            }
                          />
                        ))}
                      </Kb.Box2>
                    )}
                  </>
                )}
                <Kb.Box2 direction="vertical" gap="tiny" gapStart={true} style={styles.btnContainer}>
                  <Kb.WaitingButton
                    onClick={() =>
                      this.props.onContactSettingsSave(
                        !!this.state.contactSettingsEnabled,
                        !!this.state.contactSettingsIndirectFollowees,
                        !!this.state.contactSettingsTeamsEnabled,
                        this.state.contactSettingsSelectedTeams
                      )
                    }
                    label="Save"
                    small={true}
                    style={styles.save}
                    waitingKey={Constants.contactSettingsSaveWaitingKey}
                  />
                  {!!this.props.contactSettingsError && (
                    <Kb.Text type="BodySmall" style={styles.error}>
                      {this.props.contactSettingsError}
                    </Kb.Text>
                  )}
                </Kb.Box2>
              </Kb.Box2>
            </Kb.Box2>

            <Kb.Divider style={styles.divider} />

            <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.innerContainer}>
              <Kb.Text type="Header">Link previews</Kb.Text>
              <Kb.Text type="BodySmall">
                Your Keybase app will visit the links you share and automatically post previews.
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2
              direction="vertical"
              fullWidth={true}
              gap="xtiny"
              gapStart={true}
              style={styles.innerContainer}
            >
              <Kb.RadioButton
                key="rbalways"
                label="Always"
                onSelect={() => this._setUnfurlMode(RPCChatTypes.UnfurlMode.always)}
                selected={this._getUnfurlMode() === RPCChatTypes.UnfurlMode.always}
                disabled={this.props.unfurlMode === undefined}
              />
              <Kb.RadioButton
                key="rbwhitelist"
                label="Only for some websites"
                onSelect={() => this._setUnfurlMode(RPCChatTypes.UnfurlMode.whitelisted)}
                selected={this._getUnfurlMode() === RPCChatTypes.UnfurlMode.whitelisted}
                disabled={this.props.unfurlMode === undefined}
              />
              {this._getUnfurlMode() === RPCChatTypes.UnfurlMode.whitelisted && (
                <Kb.ScrollView style={styles.whitelist}>
                  {this._getUnfurlWhitelist(false).map((w, idx) => {
                    const wlremoved = this._isUnfurlWhitelistRemoved(w)
                    return (
                      <Kb.Box key={w} style={styles.whitelistInner}>
                        {idx === 0 && <Kb.Box style={styles.whitelistOuter} />}
                        <Kb.Box2
                          fullWidth={true}
                          direction="horizontal"
                          style={Styles.collapseStyles([
                            styles.whitelistRowContainer,
                            wlremoved ? {backgroundColor: Styles.globalColors.red_20} : undefined,
                          ])}
                        >
                          <Kb.Text type="BodySemibold">{w}</Kb.Text>
                          {wlremoved ? (
                            <Kb.Text
                              type="BodyPrimaryLink"
                              style={styles.removeText}
                              onClick={() => this._toggleUnfurlWhitelist(w)}
                            >
                              Restore
                            </Kb.Text>
                          ) : (
                            <Kb.Box style={{position: 'relative'}}>
                              <Kb.WithTooltip tooltip="Remove">
                                <Kb.Icon
                                  onClick={() => this._toggleUnfurlWhitelist(w)}
                                  style={styles.removeIcon}
                                  type="iconfont-trash"
                                />
                              </Kb.WithTooltip>
                            </Kb.Box>
                          )}
                        </Kb.Box2>
                      </Kb.Box>
                    )
                  })}
                </Kb.ScrollView>
              )}
              <Kb.RadioButton
                key="rbnever"
                label="Never"
                onSelect={() => this._setUnfurlMode(RPCChatTypes.UnfurlMode.never)}
                selected={this._getUnfurlMode() === RPCChatTypes.UnfurlMode.never}
                disabled={this.props.unfurlMode === undefined}
              />
            </Kb.Box2>
            <Kb.Box2
              direction="vertical"
              gap="tiny"
              style={Styles.collapseStyles([styles.innerContainer, styles.btnContainer])}
            >
              <Kb.WaitingButton
                onClick={() => this.props.onUnfurlSave(this._getUnfurlMode(), this._getUnfurlWhitelist(true))}
                label="Save"
                small={true}
                style={styles.save}
                disabled={this._isUnfurlSaveDisabled()}
                waitingKey={Constants.chatUnfurlWaitingKey}
              />
              {this.props.unfurlError && (
                <Kb.Text type="BodySmall" style={styles.error}>
                  {this.props.unfurlError}
                </Kb.Text>
              )}
            </Kb.Box2>

            {(showDesktopSound || showMobileSound) && (
              <>
                <Kb.Divider style={styles.divider} />
                <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.innerContainer}>
                  <Kb.Text type="Header">Sounds</Kb.Text>
                  <>
                    {showDesktopSound && (
                      <Kb.Checkbox
                        onCheck={this.props.onToggleSound}
                        checked={this.props.sound}
                        label="Play a sound for new messages"
                      />
                    )}
                    {showMobileSound && (
                      <Group
                        allowEdit={this.props.allowEdit}
                        groupName="sound"
                        onToggle={this.props.onToggle}
                        settings={this.props.groups.get('sound')!.settings}
                        unsubscribedFromAll={false}
                      />
                    )}
                  </>
                </Kb.Box2>
              </>
            )}
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    )
  }
}

const TeamRow = ({
  checked,
  isOpen,
  name,
  onCheck,
}: {
  checked: boolean
  isOpen: boolean
  name: string
  onCheck: (c: boolean) => void
}) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamRowContainer}>
      <Kb.Checkbox checked={checked} onCheck={checked => onCheck(checked)} style={styles.teamCheckbox} />
      <Kb.Avatar isTeam={true} size={Styles.isMobile ? 32 : 24} teamname={name} />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamNameContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamText}>
          <Kb.Text type="BodySemibold" lineClamp={1}>
            {name}
          </Kb.Text>
          {isOpen && (
            <Kb.Meta title="open" style={styles.teamMeta} backgroundColor={Styles.globalColors.green} />
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  btnContainer: {
    alignSelf: 'flex-start',
  },
  checkboxIndented: Styles.platformStyles({
    isElectron: {paddingLeft: Styles.globalMargins.medium},
    isMobile: {paddingBottom: Styles.globalMargins.medium, paddingLeft: Styles.globalMargins.small},
  }),
  container: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
      width: '100%',
    },
  }),
  divider: {
    marginBottom: Styles.globalMargins.small,
  },
  error: {
    color: Styles.globalColors.redDark,
  },
  innerContainer: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isElectron: {
      maxWidth: 600,
    },
  }),
  removeIcon: Styles.platformStyles({
    isElectron: {
      position: 'absolute',
      right: 0,
      top: 4,
    },
  }),
  removeText: {
    color: Styles.globalColors.black,
  },
  save: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.tiny,
  },
  teamCheckbox: Styles.platformStyles({
    isElectron: {alignSelf: 'center', marginRight: Styles.globalMargins.tiny},
    isMobile: {marginRight: Styles.globalMargins.medium},
  }),
  teamMeta: {
    alignSelf: 'center',
    marginLeft: Styles.globalMargins.xtiny,
    marginTop: 2,
  },
  teamNameContainer: {
    alignSelf: 'center',
    flexShrink: 1,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.small,
  },
  teamRowContainer: {
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.isMobile ? Styles.globalMargins.large : 48,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.xtiny,
  },
  teamText: {
    alignSelf: 'flex-start',
  },
  whitelist: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      backgroundColor: Styles.globalColors.blueGrey,
      marginBottom: Styles.globalMargins.xtiny,
      marginLeft: 22,
      marginTop: Styles.globalMargins.xtiny,
      paddingRight: Styles.globalMargins.medium,
    },
    isElectron: {
      height: 150,
      width: '100%',
    },
    isMobile: {
      width: '95%',
    },
  }),
  whitelistInner: {
    marginBottom: 1,
    paddingRight: Styles.globalMargins.tiny,
  },
  whitelistOuter: {
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
  whitelistRowContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      flexShrink: 0,
      height: 40,
      justifyContent: 'space-between',
      marginLeft: Styles.globalMargins.tiny,
      padding: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.small,
    },
  }),
}))
