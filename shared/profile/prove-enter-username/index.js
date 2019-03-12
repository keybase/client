// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/profile'
import Modal from '../modal'
import type {PlatformsExpandedType} from '../../constants/types/more'

type Props = {|
  platform: PlatformsExpandedType,
  username: string,
  errorText: string,
  onContinue: (username: string) => void,
  onCancel: () => void,
|}

type State = {|
  canSubmit: boolean,
  username: string,
|}

class EnterUsername extends React.Component<Props, State> {
  state = {canSubmit: false, username: ''}
  _submit = () => {
    this.state.canSubmit && this.props.onContinue(this.state.username)
  }
  _onChangeUsername = username => this.setState({canSubmit: !!username.length, username})
  render() {
    const pt = platformText[this.props.platform]
    if (!pt || !pt.headerText) {
      // TODO support generic proofs
      throw new Error(`Proofs for platform ${this.props.platform} are unsupported.`)
    }
    const {headerText, floatingLabelText, hintText} = pt
    return (
      <Modal>
        <Kb.Box2 direction="vertical" gap="small">
          {this.props.errorText && (
            <Kb.Box2 direction="vertical" gap="small" style={styles.error}>
              <Kb.Text negative={true} type="BodySemibold">
                {this.props.errorText}
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.Text center={true} type="Header">
            {headerText}
          </Kb.Text>
          <Kb.PlatformIcon
            style={styles.centered}
            platform={this.props.platform}
            overlay={'icon-proof-unfinished'}
            overlayColor={Styles.globalColors.grey}
          />
          <Kb.Input
            autoFocus={true}
            floatingHintTextOverride={floatingLabelText}
            hintText={hintText}
            value={this.state.username}
            onChangeText={this._onChangeUsername}
            onEnterKeyDown={this._submit}
          />
          <UsernameTips platform={this.props.platform} />
          <Kb.Box2 direction="horizontal" gap="small">
            <Kb.WaitingButton
              waitingKey={Constants.waitingKey}
              onlyDisable={true}
              type="Secondary"
              onClick={this.props.onCancel}
              label="Cancel"
            />
            <Kb.WaitingButton
              waitingKey={Constants.waitingKey}
              disabled={!this.state.canSubmit}
              type="Primary"
              onClick={this._submit}
              label="Continue"
            />
          </Kb.Box2>
        </Kb.Box2>
      </Modal>
    )
  }
}

const UsernameTips = ({platform}) =>
  platform === 'hackernews' ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tips}>
      <Kb.Text type="BodySmallSemibold">
        &bull; You must have karma &ge; 2<br />
        &bull; You must enter your uSeRName with exact case
      </Kb.Text>
    </Kb.Box2>
  ) : null

const standardText = (name: string) => ({
  floatingLabelText: `Your ${name} username`,
  headerText: `Prove your ${name} identity`,
  hintText: `Your ${name} username`,
})

const invalidText = () => ({
  floatingLabelText: '',
  headerText: '',
  hintText: '',
})

const platformText = {
  btc: {
    floatingLabelText: 'Your Bitcoin address',
    headerText: 'Set a Bitcoin address',
    hintText: 'Your Bitcoin address',
  },
  dns: {
    floatingLabelText: '',
    headerText: 'Prove your domain',
    hintText: 'yourdomain.com',
  },
  dnsOrGenericWebSite: invalidText(),
  facebook: standardText('Facebook'),
  github: standardText('GitHub'),
  hackernews: standardText('Hacker News'),
  http: {
    floatingLabelText: '',
    headerText: 'Prove your http website',
    hintText: 'http://whatever.yoursite.com',
  },
  https: {
    floatingLabelText: '',
    headerText: 'Prove your https website',
    hintText: 'https://whatever.yoursite.com',
  },
  pgp: invalidText(),
  reddit: standardText('Reddit'),
  rooter: invalidText(),
  twitter: standardText('Twitter'),
  web: {
    floatingLabelText: '',
    headerText: 'Prove your website',
    hintText: 'whatever.yoursite.com',
  },
  zcash: {
    floatingLabelText: 'Your Zcash address',
    headerText: 'Set a Zcash address',
    hintText: 'Your z_address or t_address',
  },
}

const styles = Styles.styleSheetCreate({
  centered: {alignSelf: 'center'},
  error: {
    backgroundColor: Styles.globalColors.red,
    padding: Styles.globalMargins.medium,
  },
  tips: {
    padding: Styles.globalMargins.small,
  },
})

export default EnterUsername
