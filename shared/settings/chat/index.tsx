import * as React from 'react'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Constants from '../../constants/settings'
import {TeamDetails} from '../../constants/types/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  contactSettingsEnabled?: boolean
  contactSettingsDirectFollowees: boolean
  contactSettingsIndirectFollowees: boolean
  unfurlMode?: RPCChatTypes.UnfurlMode
  unfurlWhitelist?: Array<string>
  unfurlError?: string
  onContactSettingsSave: () => void
  onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) => void
  onRefresh: () => void
  teams: Array<TeamDetails>
}

type State = {
  contactSettingsDirectFollowees?: boolean | null
  contactSettingsEnabled?: boolean | null
  contactSettingsIndirectFollowees?: boolean | null
  unfurlSelected?: RPCChatTypes.UnfurlMode
  unfurlWhitelistRemoved: {[K in string]: boolean}
}

class Chat extends React.Component<Props, State> {
  state = {
    contactSettingsDirectFollowees: undefined,
    contactSettingsEnabled: undefined,
    contactSettingsIndirectFollowees: undefined,
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
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.contactSettingsEnabled !== prevProps.contactSettingsEnabled) {
      this.setState({contactSettingsEnabled: this.props.contactSettingsEnabled})
    }
    if (this.props.contactSettingsDirectFollowees !== prevProps.contactSettingsDirectFollowees) {
      this.setState({contactSettingsDirectFollowees: this.props.contactSettingsDirectFollowees})
    }
    if (this.props.contactSettingsIndirectFollowees !== prevProps.contactSettingsIndirectFollowees) {
      this.setState({contactSettingsIndirectFollowees: this.props.contactSettingsIndirectFollowees})
    }
  }

  render() {
    console.warn('props', this.props)
    return (
      <Kb.Box2 direction="vertical" fullHeight={true} gap="tiny" style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="Header">Contact settings</Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Checkbox
            label="Only let someone message me or add me to a team if:"
            onCheck={() =>
              this.setState(prevState => ({contactSettingsEnabled: !prevState.contactSettingsEnabled}))
            }
            checked={!!this.state.contactSettingsEnabled}
            disabled={this.props.contactSettingsEnabled === undefined}
          />
          {!!this.state.contactSettingsEnabled && (
            <>
              <Kb.Checkbox
                label="I follow them, or..."
                onCheck={checked => this.setState({contactSettingsDirectFollowees: checked})}
                checked={!!this.state.contactSettingsDirectFollowees}
                disabled={!!this.props.contactSettingsIndirectFollowees}
              />
              <Kb.Checkbox
                label="I follow someone who follows them, or..."
                onCheck={checked =>
                  this.setState({
                    contactSettingsDirectFollowees: true,
                    contactSettingsIndirectFollowees: checked,
                  })
                }
                checked={!!this.state.contactSettingsIndirectFollowees}
              />
              <Kb.Checkbox
                label="They're in one of these teams with me:"
                onCheck={() => {}}
                checked={true}
                disabled={false}
              />
              <Kb.ScrollView style={styles.teamList}>
                {this.props.teams.map(teamDetails => (
                  <TeamRow
                    key={teamDetails.id}
                    name={teamDetails.teamname}
                    isOpen={teamDetails.isOpen}
                    membercount={teamDetails.memberCount}
                  />
                ))}
              </Kb.ScrollView>
            </>
          )}
          <Kb.Box2 direction="vertical" gap="tiny">
            <Kb.WaitingButton
              onClick={() => this.props.onUnfurlSave(this._getUnfurlMode(), this._getUnfurlWhitelist(true))}
              label="Save"
              style={styles.save}
              disabled={this._isUnfurlSaveDisabled()}
              waitingKey={Constants.chatUnfurlWaitingKey}
            />
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
        <Kb.Box2 direction="vertical" gap="tiny">
          <Kb.WaitingButton
            onClick={() => this.props.onUnfurlSave(this._getUnfurlMode(), this._getUnfurlWhitelist(true))}
            label="Save"
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
    )
  }
}

const TeamRow = ({name, isOpen, membercount}) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamRowContainer}>
      <Kb.Checkbox onCheck={() => {}} style={styles.teamCheckbox} checked={false} />
      <Kb.Avatar isTeam={true} size={Styles.isMobile ? 48 : 32} teamname={name} />
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.teamNameContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamText}>
          <Kb.Text type="BodySemibold" lineClamp={1}>
            {name}
          </Kb.Text>
          {isOpen && (
            <Kb.Meta title="open" style={styles.teamMeta} backgroundColor={Styles.globalColors.green} />
          )}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" style={styles.teamText}>
          <Kb.Text type="BodySmall">{membercount + ' member' + (membercount !== 1 ? 's' : '')}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)
const styles = Styles.styleSheetCreate(() => ({
  container: {
    padding: Styles.globalMargins.small,
    width: '100%',
  },
  divider: {
    height: Styles.globalMargins.xxtiny,
  },
  error: {
    color: Styles.globalColors.redDark,
  },
  save: {
    marginTop: Styles.globalMargins.tiny,
  },
  teamCheckbox: {
    alignSelf: 'center',
    paddingRight: Styles.globalMargins.tiny,
  },
  teamList: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      borderColor: Styles.globalColors.greyLight,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
    },
    isElectron: {
      height: 350,
      marginLeft: 22,
      minWidth: 305,
    },
    isMobile: {
      height: 350,
      width: '100%',
    },
  }),
  teamMeta: {
    alignSelf: 'center',
    marginLeft: Styles.globalMargins.xtiny,
    marginTop: 2,
  },
  teamNameContainer: {
    flexShrink: 1,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
  },
  teamRowContainer: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.tiny,
    },
    isMobile: {
      minHeight: Styles.isMobile ? 64 : 48,
    },
  }),
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
