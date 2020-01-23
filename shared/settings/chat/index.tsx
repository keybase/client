import * as React from 'react'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Constants from '../../constants/settings'
import {TeamDetails, TeamID} from '../../constants/types/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  contactSettingsEnabled?: boolean
  contactSettingsError: string
  contactSettingsIndirectFollowees?: boolean
  contactSettingsTeamsEnabled?: boolean
  contactSettingsSelectedTeams: {[K in TeamID]: boolean}
  unfurlMode?: RPCChatTypes.UnfurlMode
  unfurlWhitelist?: Array<string>
  unfurlError?: string
  onContactSettingsSave: (
    enabled: boolean,
    indirectFollowees: boolean,
    teamsEnabled: boolean,
    teamsList: {[k in TeamID]: boolean}
  ) => void
  onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) => void
  onRefresh: () => void
  teamDetails: Array<TeamDetails>
}

type State = {
  contactSettingsEnabled?: boolean | null
  contactSettingsIndirectFollowees?: boolean | null
  contactSettingsSelectedTeams: {[K in TeamID]: boolean}
  contactSettingsTeamsEnabled?: boolean | null
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
    return RPCChatTypes.UnfurlMode.whitelisted
  }
  _getUnfurlWhitelist(filtered: boolean) {
    return filtered
      ? (this.props.unfurlWhitelist || []).filter(w => !this.state.unfurlWhitelistRemoved[w])
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
    return (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.ScrollView>
          <Kb.Box2 direction="vertical" fullHeight={true} gap="tiny" style={styles.container}>
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="Header">Contact restrictions</Kb.Text>
            </Kb.Box2>
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
                    <Kb.Checkbox
                      label="You follow them, or..."
                      checked={true}
                      disabled={true}
                      onCheck={null}
                    />
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
                      {this.props.teamDetails.map(teamDetails => (
                        <TeamRow
                          checked={this.state.contactSettingsSelectedTeams[teamDetails.id]}
                          key={teamDetails.id}
                          isOpen={teamDetails.isOpen}
                          name={teamDetails.teamname}
                          onCheck={(checked: boolean) =>
                            this.setState(prevState => ({
                              contactSettingsSelectedTeams: {
                                ...prevState.contactSettingsSelectedTeams,
                                [teamDetails.id]: checked,
                              },
                            }))
                          }
                        />
                      ))}
                    </Kb.Box2>
                  )}
                </>
              )}
              <Kb.Box2 direction="vertical" gap="tiny" style={styles.btnContainer}>
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

            <Kb.Divider style={styles.divider} />

            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="Header">Post link previews?</Kb.Text>
              <Kb.Text type="BodySmall">
                Your Keybase app will visit the links you share and automatically post previews.
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
              <Kb.RadioButton
                key="rbalways"
                label="Always"
                onSelect={() => this._setUnfurlMode(RPCChatTypes.UnfurlMode.always)}
                selected={this._getUnfurlMode() === RPCChatTypes.UnfurlMode.always}
                disabled={this.props.unfurlMode === undefined}
              />
              <Kb.RadioButton
                key="rbwhitelist"
                label="Yes, but only for these sites:"
                onSelect={() => this._setUnfurlMode(RPCChatTypes.UnfurlMode.whitelisted)}
                selected={this._getUnfurlMode() === RPCChatTypes.UnfurlMode.whitelisted}
                disabled={this.props.unfurlMode === undefined}
              />
              <Kb.ScrollView style={styles.whitelist}>
                {this._getUnfurlWhitelist(false).map(w => {
                  const wlremoved = this._isUnfurlWhitelistRemoved(w)
                  return (
                    <React.Fragment key={w}>
                      <Kb.Box2
                        fullWidth={true}
                        direction="horizontal"
                        style={Styles.collapseStyles([
                          wlremoved ? {backgroundColor: Styles.globalColors.red_20} : undefined,
                          styles.whitelistRowContainer,
                        ])}
                      >
                        <Kb.Text type="BodySemibold">{w}</Kb.Text>
                        <Kb.Text
                          type="BodyPrimaryLink"
                          style={wlremoved ? {color: Styles.globalColors.whiteOrWhite} : undefined}
                          onClick={() => this._toggleUnfurlWhitelist(w)}
                        >
                          {wlremoved ? 'Restore' : 'Remove'}
                        </Kb.Text>
                      </Kb.Box2>
                      <Kb.Divider />
                    </React.Fragment>
                  )
                })}
              </Kb.ScrollView>
              <Kb.RadioButton
                key="rbnever"
                label="Never"
                onSelect={() => this._setUnfurlMode(RPCChatTypes.UnfurlMode.never)}
                selected={this._getUnfurlMode() === RPCChatTypes.UnfurlMode.never}
                disabled={this.props.unfurlMode === undefined}
              />
            </Kb.Box2>
            <Kb.Box2 direction="vertical" gap="tiny" style={styles.btnContainer}>
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
            <Kb.Divider style={styles.divider} />
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    )
  }
}

const TeamRow = ({checked, isOpen, name, onCheck}) => (
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
  container: {
    padding: Styles.globalMargins.small,
    width: '100%',
  },
  divider: {
    marginBottom: Styles.globalMargins.small,
  },
  error: {
    color: Styles.globalColors.redDark,
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
      borderColor: Styles.globalColors.greyLight,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
    },
    isElectron: {
      height: 150,
      marginLeft: 22,
      minWidth: 305,
    },
    isMobile: {
      height: 150,
      width: '100%',
    },
  }),
  whitelistRowContainer: {
    flexShrink: 0,
    justifyContent: 'space-between',
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
}))

export default Kb.HeaderHoc(Chat)
