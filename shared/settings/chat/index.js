// @flow
import * as React from 'react'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  unfurlMode: RPCChatTypes.UnfurlMode,
  unfurlWhitelist: Array<string>,
  onUnfurlSave: (RPCChatTypes.UnfurlMode, Array<string>) => void,
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
  _getUnfurlMode(): RPCChatTypes.UnfurlMode {
    return this.state.unfurlSelected !== undefined ? this.state.unfurlSelected : this.props.unfurlMode
  }
  _getUnfurlWhitelist() {
    return this.state.unfurlWhitelist !== undefined ? this.state.unfurlWhitelist : this.props.unfurlWhitelist
  }
  _setUnfurlMode(mode: RPCChatTypes.UnfurlMode) {
    this.setState({unfurlSelected: mode})
  }
  _removeUnfurlWhitelist(domain: string) {
    this.setState({unfurlWhitelist: this._getUnfurlWhitelist().filter(e => e !== domain)})
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.container}>
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
          />
          <Kb.RadioButton
            key="rbwhitelist"
            label="Yes, but only for these sites:"
            onSelect={() => this._setUnfurlMode(RPCChatTypes.unfurlUnfurlMode.whitelisted)}
            selected={this._getUnfurlMode() === RPCChatTypes.unfurlUnfurlMode.whitelisted}
          />
          <Kb.Box2 direction="vertical" style={styles.whitelist}>
            {this._getUnfurlWhitelist().map(w => {
              return (
                <React.Fragment key={w}>
                  <Kb.Box2 fullWidth={true} direction="horizontal" style={styles.whitelistContainer}>
                    <Kb.Text type="BodySemibold">{w}</Kb.Text>
                    <Kb.Text
                      type="BodyPrimaryLink"
                      style={styles.whitelistRemove}
                      onClick={() => this._removeUnfurlWhitelist(w)}
                    >
                      Remove
                    </Kb.Text>
                  </Kb.Box2>
                  <Kb.Divider style={styles.whitelistDivider} fullWidth={true} />
                </React.Fragment>
              )
            })}
          </Kb.Box2>
          <Kb.RadioButton
            key="rbnever"
            label="Never"
            onSelect={() => this._setUnfurlMode(RPCChatTypes.unfurlUnfurlMode.never)}
            selected={this._getUnfurlMode() === RPCChatTypes.unfurlUnfurlMode.never}
          />
        </Kb.Box2>
        <Kb.Divider style={styles.divider} />
        <Kb.Button
          onClick={() => this.props.onUnfurlSave(this._getUnfurlMode(), this._getUnfurlWhitelist())}
          label="Save"
          type="Primary"
          style={styles.save}
          disabled={!this._isUnfurlModeSelected() && !this._isUnfurlWhitelistChanged()}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      marginLeft: 28,
    },
  }),
  divider: {
    height: 2,
  },
  save: Styles.platformStyles({
    isElectron: {
      marginTop: 8,
      alignSelf: 'flex-start',
    },
  }),
  whitelist: Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: Styles.globalColors.lightGrey,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      height: 95,
      minWidth: 305,
      paddingTop: 3,
      paddingLeft: 9,
      paddingBottom: 3,
      paddingRight: 8,
      marginLeft: 26,
      overflow: 'auto',
    },
  }),
  whitelistRemove: Styles.platformStyles({
    isElectron: {
      marginLeft: 'auto',
    },
  }),
  whitelistContainer: Styles.platformStyles({
    isElectron: {
      flexShrink: 0,
    },
  }),
  whitelistDivider: Styles.platformStyles({
    isElectron: {
      marginTop: 3,
      marginBottom: 4,
    },
  }),
})

export default Chat
