import * as React from 'react'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Constants from '../../constants/settings'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  unfurlMode?: RPCChatTypes.UnfurlMode
  unfurlWhitelist?: Array<string>
  unfurlError?: string
  onUnfurlSave: (arg0: RPCChatTypes.UnfurlMode, array: Array<string>) => void
  onRefresh: () => void
}

type State = {
  unfurlSelected?: RPCChatTypes.UnfurlMode
  unfurlWhitelistRemoved: {[K in string]: boolean}
}

class Chat extends React.Component<Props, State> {
  state = {unfurlSelected: undefined, unfurlWhitelistRemoved: {}}
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
    this.setState({
      unfurlWhitelistRemoved: {
        ...this.state.unfurlWhitelistRemoved,
        [domain]: !this.state.unfurlWhitelistRemoved[domain],
      },
    })
  }
  _isUnfurlWhitelistRemoved(domain: string) {
    return this.state.unfurlWhitelistRemoved[domain]
  }
  _isSaveDisabled() {
    return (
      this.props.unfurlMode === undefined ||
      (!this._isUnfurlModeSelected() && !this._isUnfurlWhitelistChanged())
    )
  }

  componentDidMount() {
    this.props.onRefresh()
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullHeight={true} gap="tiny" style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodyBig">Post Link Previews?</Kb.Text>
          <Kb.Text type="Body">
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
                      style={wlremoved ? {color: Styles.globalColors.white} : undefined}
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
        <Kb.Divider style={styles.divider} />
        <Kb.Box2 direction="vertical" gap="tiny">
          <Kb.WaitingButton
            onClick={() => this.props.onUnfurlSave(this._getUnfurlMode(), this._getUnfurlWhitelist(true))}
            label="Save"
            style={styles.save}
            disabled={this._isSaveDisabled()}
            waitingKey={Constants.chatUnfurlWaitingKey}
          />
          {this.props.unfurlError && (
            <Kb.Text type="BodySmall" style={styles.error}>
              {this.props.unfurlError}
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      marginLeft: 28,
      paddingTop: 20,
    },
    isMobile: {
      padding: 20,
    },
  }),
  divider: {
    height: Styles.globalMargins.xxtiny,
  },
  error: {
    color: Styles.globalColors.redDark,
  },
  save: {
    marginTop: Styles.globalMargins.tiny,
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
})

export default Kb.HeaderHoc(Chat)
