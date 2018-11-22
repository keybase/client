// @flow
import * as React from 'react'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Constants from '../../constants/settings'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  unfurlMode?: RPCChatTypes.UnfurlMode,
  unfurlWhitelist?: Array<string>,
  unfurlError?: string,
  onUnfurlSave: (RPCChatTypes.UnfurlMode, Array<string>) => void,
  onRefresh: () => void,
}

type State = {
  unfurlSelected?: RPCChatTypes.UnfurlMode,
  unfurlWhitelist?: Array<string>,
}

class Chat extends React.Component<Props, State> {
  state = {}
  _isUnfurlModeSelected() {
    return this.state.unfurlSelected !== undefined
  }
  _isUnfurlWhitelistChanged() {
    return this.state.unfurlWhitelist !== undefined
  }
  _getUnfurlMode() {
    return this.state.unfurlSelected !== undefined
      ? this.state.unfurlSelected
      : this.props.unfurlMode || RPCChatTypes.unfurlUnfurlMode.whitelisted
  }
  _getUnfurlWhitelist() {
    return this.state.unfurlWhitelist !== undefined
      ? this.state.unfurlWhitelist
      : this.props.unfurlWhitelist || []
  }
  _setUnfurlMode(mode: RPCChatTypes.UnfurlMode) {
    this.setState({unfurlSelected: mode})
  }
  _removeUnfurlWhitelist(domain: string) {
    this.setState({unfurlWhitelist: this._getUnfurlWhitelist().filter(e => e !== domain)})
  }
  _isSaveDisabled() {
    return !this.props.unfurlMode || (!this._isUnfurlModeSelected() && !this._isUnfurlWhitelistChanged())
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
            onSelect={() => this._setUnfurlMode(RPCChatTypes.unfurlUnfurlMode.always)}
            selected={this._getUnfurlMode() === RPCChatTypes.unfurlUnfurlMode.always}
            disabled={!this.props.unfurlMode}
          />
          <Kb.RadioButton
            key="rbwhitelist"
            label="Yes, but only for these sites:"
            onSelect={() => this._setUnfurlMode(RPCChatTypes.unfurlUnfurlMode.whitelisted)}
            selected={this._getUnfurlMode() === RPCChatTypes.unfurlUnfurlMode.whitelisted}
            disabled={!this.props.unfurlMode}
          />
          <Kb.ScrollView style={styles.whitelist}>
            {this._getUnfurlWhitelist().map(w => {
              return (
                <React.Fragment key={w}>
                  <Kb.Box2 fullWidth={true} direction="horizontal" style={styles.whitelistRowContainer}>
                    <Kb.Text type="BodySemibold">{w}</Kb.Text>
                    <Kb.Text type="BodyPrimaryLink" onClick={() => this._removeUnfurlWhitelist(w)}>
                      Remove
                    </Kb.Text>
                  </Kb.Box2>
                  <Kb.Divider style={styles.whitelistDivider} fullWidth={true} />
                </React.Fragment>
              )
            })}
          </Kb.ScrollView>
          <Kb.RadioButton
            key="rbnever"
            label="Never"
            onSelect={() => this._setUnfurlMode(RPCChatTypes.unfurlUnfurlMode.never)}
            selected={this._getUnfurlMode() === RPCChatTypes.unfurlUnfurlMode.never}
            disabled={!this.props.unfurlMode}
          />
        </Kb.Box2>
        <Kb.Divider style={styles.divider} />
        <Kb.Box2 direction="vertical" gap="tiny">
          <Kb.WaitingButton
            onClick={() => this.props.onUnfurlSave(this._getUnfurlMode(), this._getUnfurlWhitelist())}
            label="Save"
            type="Primary"
            style={styles.save}
            disabled={this._isSaveDisabled()}
            waitingKey={Constants.waitingKey}
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
    height: 2,
  },
  save: Styles.platformStyles({
    common: {
      marginTop: 8,
    },
  }),
  whitelist: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: Styles.globalColors.lightGrey,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
    },
    isElectron: {
      height: 150,
      minWidth: 305,
      paddingTop: 3,
      paddingLeft: 9,
      paddingBottom: 3,
      paddingRight: 8,
      marginLeft: 26,
    },
    isMobile: {
      height: 150,
      width: '100%',
      paddingLeft: 5,
      paddingRight: 5,
    },
  }),
  whitelistRowContainer: {
    flexShrink: 0,
    justifyContent: 'space-between',
  },
  whitelistDivider: {
    marginTop: 3,
    marginBottom: 4,
  },
  error: {
    color: Styles.globalColors.red,
  },
})

export default Kb.HeaderHoc(Chat)
