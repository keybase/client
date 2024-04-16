import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import Modal from '../modal'
import type * as T from '@/constants/types'

type Props = {
  platform: T.More.PlatformsExpandedType
  username: string
  errorText: string
  onSubmit: (username: string) => void
  onCancel: () => void
}

type State = {
  canSubmit: boolean
  username: string
}

class EnterUsername extends React.Component<Props, State> {
  state = {canSubmit: false, username: ''}
  _submit = () => {
    this.state.canSubmit && this.props.onSubmit(this.state.username)
  }
  _onChangeUsername = (username: string) => this.setState({canSubmit: !!username.length, username})
  render() {
    const pt = platformText[this.props.platform]
    if (!pt.headerText) {
      // TODO support generic proofs
      throw new Error(`Proofs for platform ${this.props.platform} are unsupported.`)
    }
    const {headerText, hintText} = pt
    return (
      <Modal onCancel={this.props.onCancel} skipButton={true} title={C.isMobile ? headerText : undefined}>
        {!!this.props.errorText && (
          <Kb.Box2 direction="vertical" gap="small" style={styles.error} fullWidth={true}>
            <Kb.Text center={true} negative={true} type="BodySemibold">
              {this.props.errorText}
            </Kb.Text>
          </Kb.Box2>
        )}
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
          {C.isMobile ? null : (
            <Kb.Text center={true} type="Header">
              {headerText}
            </Kb.Text>
          )}
          <Kb.PlatformIcon
            style={styles.centered}
            platform={this.props.platform}
            overlay="icon-proof-unfinished"
            overlayColor={Kb.Styles.globalColors.greyDark}
          />
          <Kb.LabeledInput
            autoFocus={true}
            placeholder={hintText}
            value={this.state.username}
            onChangeText={this._onChangeUsername}
            onEnterKeyDown={this._submit}
          />
          <UsernameTips platform={this.props.platform} />
          <Kb.Box2 direction="horizontal" gap="small">
            <Kb.WaitingButton
              waitingKey={C.Profile.waitingKey}
              onlyDisable={true}
              type="Dim"
              onClick={this.props.onCancel}
              label="Cancel"
            />
            <Kb.WaitingButton
              waitingKey={C.Profile.waitingKey}
              disabled={!this.state.canSubmit}
              onClick={this._submit}
              label="Continue"
            />
          </Kb.Box2>
        </Kb.Box2>
      </Modal>
    )
  }
}

const UsernameTips = ({platform}: {platform: T.More.PlatformsExpandedType}) =>
  platform === 'hackernews' ? (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tips}>
      <Kb.Text type="BodySmallSemibold">&bull; You must have karma &ge; 2</Kb.Text>
      <Kb.Text type="BodySmallSemibold">&bull; You must enter your uSeRName with exact case</Kb.Text>
    </Kb.Box2>
  ) : null

const standardText = (name: string) => ({
  headerText: C.isMobile ? `Prove ${name}` : `Prove your ${name} identity`,
  hintText: `Your ${name} username`,
})

const invalidText = () => ({
  headerText: '',
  hintText: '',
})

const platformText = {
  btc: {
    headerText: 'Set a Bitcoin address',
    hintText: 'Your Bitcoin address',
  },
  dns: {
    headerText: 'Prove your domain',
    hintText: 'yourdomain.com',
  },
  dnsOrGenericWebSite: invalidText(),
  facebook: standardText('Facebook'),
  github: standardText('GitHub'),
  hackernews: standardText('Hacker News'),
  http: {
    headerText: 'Prove your http website',
    hintText: 'http://whatever.yoursite.com',
  },
  https: {
    headerText: 'Prove your https website',
    hintText: 'https://whatever.yoursite.com',
  },
  pgp: invalidText(),
  reddit: standardText('Reddit'),
  rooter: invalidText(),
  twitter: standardText('Twitter'),
  web: {
    headerText: 'Prove your website',
    hintText: 'whatever.yoursite.com',
  },
  zcash: {
    headerText: 'Set a Zcash address',
    hintText: 'Your z_address or t_address',
  },
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  centered: {alignSelf: 'center'},
  error: {
    backgroundColor: Kb.Styles.globalColors.red,
    borderRadius: Kb.Styles.borderRadius,
    marginBottom: Kb.Styles.globalMargins.small,
    padding: Kb.Styles.globalMargins.medium,
  },
  tips: {padding: Kb.Styles.globalMargins.small},
}))

export default EnterUsername
