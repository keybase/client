import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import type {NotificationsGroupState} from '@/constants/settings-notifications'
import {Group} from './notifications/render'

const emptyList = new Array<string>()

const Container = () => {
  const contactSettingsEnabled = C.useSettingsChatState(s => s.contactSettings.settings?.enabled)
  const contactSettingsIndirectFollowees = C.useSettingsChatState(
    s => s.contactSettings.settings?.allowFolloweeDegrees === 2
  )
  const contactSettingsTeams = C.useSettingsChatState(s => s.contactSettings.settings?.teams)
  const contactSettingsTeamsEnabled = C.useSettingsChatState(s => s.contactSettings.settings?.allowGoodTeams)
  const whitelist = C.useSettingsChatState(s => s.unfurl.unfurlWhitelist)
  const unfurlWhitelist = whitelist ?? emptyList
  const allowEdit = C.useSettingsNotifState(s => s.allowEdit)
  const contactSettingsError = C.useSettingsChatState(s => s.contactSettings.error)
  const groups = C.useSettingsNotifState(s => s.groups)
  const mobileHasPermissions = C.usePushState(s => s.hasPermissions)
  const sound = C.useConfigState(s => s.notifySound) // desktop
  const _teamMeta = C.useTeamsState(s => s.teamMeta)
  const unfurlError = C.useSettingsChatState(s => s.unfurl.unfurlError)
  const unfurlMode = C.useSettingsChatState(s => s.unfurl.unfurlMode)
  const contactSettingsSaved = C.useSettingsChatState(s => s.dispatch.contactSettingsSaved)
  const contactSettingsRefresh = C.useSettingsChatState(s => s.dispatch.contactSettingsRefresh)
  const unfurlSettingsRefresh = C.useSettingsChatState(s => s.dispatch.unfurlSettingsRefresh)
  const unfurlSettingsSaved = C.useSettingsChatState(s => s.dispatch.unfurlSettingsSaved)
  const notifRefresh = C.useSettingsNotifState(s => s.dispatch.refresh)
  const notifToggle = C.useSettingsNotifState(s => s.dispatch.toggle)

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = C.isMobile
    ? () => {
        navigateUp()
      }
    : undefined
  const onContactSettingsSave = contactSettingsSaved
  const loadSettings = C.useSettingsState(s => s.dispatch.loadSettings)
  const onRefresh = () => {
    // Security: misc
    loadSettings()
    notifRefresh()

    // Security: contact settings
    contactSettingsRefresh()

    // Link previews
    unfurlSettingsRefresh()
  }
  const onToggle = notifToggle
  const onToggleSound = C.useConfigState(s => s.dispatch.setNotifySound)
  const onUnfurlSave = unfurlSettingsSaved

  const teamMeta = C.Teams.sortTeamsByName(_teamMeta)
  const serverSelectedTeams = new Map(contactSettingsTeams?.map(t => [t.teamID, {enabled: t.enabled}]))
  const selectedTeams: {[K in T.Teams.TeamID]: boolean} = {}
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
  contactSettingsSelectedTeams: {[K in T.Teams.TeamID]: boolean}
  groups: T.Immutable<ReadonlyMap<string, NotificationsGroupState>>
  sound: boolean
  unfurlMode?: T.RPCChat.UnfurlMode
  unfurlWhitelist?: ReadonlyArray<string>
  unfurlError?: string
  onBack?: () => void
  onContactSettingsSave: (
    enabled: boolean,
    indirectFollowees: boolean,
    teamsEnabled: boolean,
    teamsList: {[k in T.Teams.TeamID]: boolean}
  ) => void
  onToggle: (groupName: string, name: string) => void
  onToggleSound: (notifySound: boolean) => void
  onUnfurlSave: (mode: T.RPCChat.UnfurlMode, whitelist: ReadonlyArray<string>) => void
  onRefresh: () => void
  teamMeta: ReadonlyArray<T.Teams.TeamMeta>
}

type State = {
  contactSettingsEnabled?: boolean
  contactSettingsIndirectFollowees?: boolean
  contactSettingsSelectedTeams: {[K in T.Teams.TeamID]: boolean}
  contactSettingsTeamsEnabled?: boolean
  unfurlSelected?: T.RPCChat.UnfurlMode
  unfurlWhitelistRemoved: {[K in string]: boolean}
}

class Chat extends React.Component<Props, State> {
  state: State = {
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
      Object.keys(this.state.unfurlWhitelistRemoved).filter(d => this.state.unfurlWhitelistRemoved[d])
        .length > 0
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
    return T.RPCChat.UnfurlMode.whitelisted
  }
  _getUnfurlWhitelist(filtered: boolean) {
    return filtered
      ? (this.props.unfurlWhitelist || []).filter(w => !this.state.unfurlWhitelistRemoved[w])
      : this.props.unfurlWhitelist || []
  }
  _setUnfurlMode(mode: T.RPCChat.UnfurlMode) {
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
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.contactSettingsEnabled !== prevProps.contactSettingsEnabled ||
      (this.props.contactSettingsEnabled !== undefined && this.state.contactSettingsEnabled === undefined)
    ) {
      this.setState({contactSettingsEnabled: this.props.contactSettingsEnabled})
    }
    if (
      this.props.contactSettingsIndirectFollowees !== prevProps.contactSettingsIndirectFollowees ||
      (this.props.contactSettingsIndirectFollowees !== undefined &&
        this.state.contactSettingsIndirectFollowees === undefined)
    ) {
      this.setState({contactSettingsIndirectFollowees: this.props.contactSettingsIndirectFollowees})
    }
    if (
      this.props.contactSettingsTeamsEnabled !== prevProps.contactSettingsTeamsEnabled ||
      (this.props.contactSettingsTeamsEnabled !== undefined &&
        this.state.contactSettingsTeamsEnabled === undefined)
    ) {
      this.setState({contactSettingsTeamsEnabled: this.props.contactSettingsTeamsEnabled})
    }
    // Create an initial copy of teams data into state, so it can be mutated there.
    if (
      Object.keys(this.props.contactSettingsSelectedTeams).length > 0 &&
      Object.keys(this.state.contactSettingsSelectedTeams).length === 0
    ) {
      this.setState({contactSettingsSelectedTeams: this.props.contactSettingsSelectedTeams})
    }
  }

  render() {
    const showDesktopSound = !C.isMobile && !C.isLinux
    const showMisc = C.isMac || C.isIOS
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
                      gap={Kb.Styles.isMobile ? 'small' : undefined}
                      gapStart={Kb.Styles.isMobile}
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
                        gap={Kb.Styles.isMobile ? 'small' : undefined}
                        gapStart={false}
                        gapEnd={true}
                      >
                        {this.props.teamMeta.map(teamMeta => (
                          <TeamRow
                            checked={this.state.contactSettingsSelectedTeams[teamMeta.id] ?? false}
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
                    waitingKey={C.SettingsChat.contactSettingsSaveWaitingKey}
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
                onSelect={() => this._setUnfurlMode(T.RPCChat.UnfurlMode.always)}
                selected={this._getUnfurlMode() === T.RPCChat.UnfurlMode.always}
                disabled={this.props.unfurlMode === undefined}
              />
              <Kb.RadioButton
                key="rbwhitelist"
                label="Only for some websites"
                onSelect={() => this._setUnfurlMode(T.RPCChat.UnfurlMode.whitelisted)}
                selected={this._getUnfurlMode() === T.RPCChat.UnfurlMode.whitelisted}
                disabled={this.props.unfurlMode === undefined}
              />
              {this._getUnfurlMode() === T.RPCChat.UnfurlMode.whitelisted && (
                <Kb.ScrollView style={styles.whitelist}>
                  {this._getUnfurlWhitelist(false).map((w, idx) => {
                    const wlremoved = this._isUnfurlWhitelistRemoved(w)
                    return (
                      <Kb.Box key={w} style={styles.whitelistInner}>
                        {idx === 0 && <Kb.Box style={styles.whitelistOuter} />}
                        <Kb.Box2
                          fullWidth={true}
                          direction="horizontal"
                          style={Kb.Styles.collapseStyles([
                            styles.whitelistRowContainer,
                            wlremoved ? {backgroundColor: Kb.Styles.globalColors.red_20} : undefined,
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
                onSelect={() => this._setUnfurlMode(T.RPCChat.UnfurlMode.never)}
                selected={this._getUnfurlMode() === T.RPCChat.UnfurlMode.never}
                disabled={this.props.unfurlMode === undefined}
              />
            </Kb.Box2>
            <Kb.Box2
              direction="vertical"
              gap="tiny"
              style={Kb.Styles.collapseStyles([styles.innerContainer, styles.btnContainer])}
            >
              <Kb.WaitingButton
                onClick={() => this.props.onUnfurlSave(this._getUnfurlMode(), this._getUnfurlWhitelist(true))}
                label="Save"
                small={true}
                style={styles.save}
                disabled={this._isUnfurlSaveDisabled()}
                waitingKey={C.SettingsChat.chatUnfurlWaitingKey}
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
            {showMisc && (
              <>
                <Kb.Divider style={styles.divider} />
                <Kb.Box2 direction="vertical" fullHeight={true} gap="tiny" style={styles.innerContainer}>
                  <Kb.Text type="Header">Misc</Kb.Text>
                  <>
                    {!!this.props.groups.get('misc')?.settings && (
                      <Group
                        allowEdit={this.props.allowEdit}
                        groupName="misc"
                        onToggle={this.props.onToggle}
                        settings={this.props.groups.get('misc')!.settings}
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
      <Kb.Avatar isTeam={true} size={Kb.Styles.isMobile ? 32 : 24} teamname={name} />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamNameContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamText}>
          <Kb.Text type="BodySemibold" lineClamp={1}>
            {name}
          </Kb.Text>
          {isOpen && (
            <Kb.Meta title="open" style={styles.teamMeta} backgroundColor={Kb.Styles.globalColors.green} />
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  btnContainer: {
    alignSelf: 'flex-start',
  },
  checkboxIndented: Kb.Styles.platformStyles({
    isElectron: {paddingLeft: Kb.Styles.globalMargins.medium},
    isMobile: {paddingBottom: Kb.Styles.globalMargins.medium, paddingLeft: Kb.Styles.globalMargins.small},
  }),
  container: Kb.Styles.platformStyles({
    common: {
      paddingBottom: Kb.Styles.globalMargins.small,
      paddingTop: Kb.Styles.globalMargins.small,
      width: '100%',
    },
  }),
  divider: {
    marginBottom: Kb.Styles.globalMargins.small,
  },
  error: {
    color: Kb.Styles.globalColors.redDark,
  },
  innerContainer: Kb.Styles.platformStyles({
    common: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    },
    isElectron: {
      maxWidth: 600,
    },
  }),
  removeIcon: Kb.Styles.platformStyles({
    isElectron: {
      position: 'absolute',
      right: 0,
      top: 4,
    },
  }),
  removeText: {
    color: Kb.Styles.globalColors.black,
  },
  save: {
    marginBottom: Kb.Styles.globalMargins.small,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  teamCheckbox: Kb.Styles.platformStyles({
    isElectron: {alignSelf: 'center', marginRight: Kb.Styles.globalMargins.tiny},
    isMobile: {marginRight: Kb.Styles.globalMargins.medium},
  }),
  teamMeta: {
    alignSelf: 'center',
    marginLeft: Kb.Styles.globalMargins.xtiny,
    marginTop: 2,
  },
  teamNameContainer: {
    alignSelf: 'center',
    flexShrink: 1,
    marginLeft: Kb.Styles.globalMargins.tiny,
    marginRight: Kb.Styles.globalMargins.small,
  },
  teamRowContainer: {
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingLeft: Kb.Styles.isMobile ? Kb.Styles.globalMargins.large : 48,
    paddingRight: Kb.Styles.globalMargins.small,
    paddingTop: Kb.Styles.globalMargins.xtiny,
  },
  teamText: {
    alignSelf: 'flex-start',
  },
  whitelist: Kb.Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      backgroundColor: Kb.Styles.globalColors.blueGrey,
      marginBottom: Kb.Styles.globalMargins.xtiny,
      marginLeft: 22,
      marginTop: Kb.Styles.globalMargins.xtiny,
      paddingRight: Kb.Styles.globalMargins.medium,
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
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
  whitelistOuter: {
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
  whitelistRowContainer: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
      flexShrink: 0,
      height: 40,
      justifyContent: 'space-between',
      marginLeft: Kb.Styles.globalMargins.tiny,
      padding: Kb.Styles.globalMargins.tiny,
      paddingRight: Kb.Styles.globalMargins.small,
    },
  }),
}))

export default Container
