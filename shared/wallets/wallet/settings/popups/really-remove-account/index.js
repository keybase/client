// @flow
import React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import WalletPopup from '../../../../wallet-popup'

type Props = Kb.PropsWithTimer<{|
  name: string,
  loading: boolean,
  onCopyKey: () => void,
  onFinish: () => void,
  onCancel: () => void,
  waitingKey: string,
  onLoadSecretKey: () => void,
|}>

type State = {
  showingToast: boolean,
}

class ReallyRemoveAccountPopup extends React.Component<Props, State> {
  state = {
    showingToast: false,
  }
  _attachmentRef = null

  componentDidMount() {
    this.props.onLoadSecretKey()
  }

  copy = () => {
    this.setState({showingToast: true}, () =>
      this.props.setTimeout(() => this.setState({showingToast: false}), 2000)
    )
    this.props.onCopyKey()
  }

  render() {
    return (
      <WalletPopup
        onClose={this.props.onCancel}
        containerStyle={styles.backgroundColor}
        headerStyle={Styles.collapseStyles([styles.backgroundColor, styles.header])}
        bottomButtons={[
          <Kb.Button
            fullWidth={Styles.isMobile}
            key={0}
            label="Copy secret key"
            onClick={this.copy}
            type="Wallet"
            ref={r => (this._attachmentRef = r)}
            waiting={this.props.loading}
          />,
          <Kb.WaitingButton
            fullWidth={Styles.isMobile}
            key={1}
            label="Finish"
            onClick={this.props.onFinish}
            type="Secondary"
            waitingKey={this.props.waitingKey}
            disabled={this.props.loading}
          />,
        ]}
      >
        <Kb.Icon
          type={Styles.isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
          style={Kb.iconCastPlatformStyles(styles.icon)}
        />
        <Kb.Text style={Styles.collapseStyles([styles.warningText, styles.mainText])} type="Header">
          One last thing! Make sure you keep a copy of your secret key before removing{' '}
          <Kb.Text type="HeaderItalic" style={styles.warningText}>
            {this.props.name}
          </Kb.Text>.
        </Kb.Text>
        <Kb.Text type="BodySmall" style={styles.warningText}>
          Paste it in a 100% safe place.
        </Kb.Text>

        <Kb.Toast visible={this.state.showingToast} attachTo={this._attachmentRef} position={'top center'}>
          <Kb.Text type="BodySmall" style={styles.toastText}>
            Copied to clipboard
          </Kb.Text>
        </Kb.Toast>
      </WalletPopup>
    )
  }
}

const styles = Styles.styleSheetCreate({
  backgroundColor: {
    backgroundColor: Styles.globalColors.yellow,
  },
  header: {
    borderBottomWidth: 0,
  },
  icon: Styles.platformStyles({
    common: {
      marginBottom: Styles.globalMargins.large,
    },
    isElectron: {
      marginTop: Styles.globalMargins.medium,
    },
    isMobile: {
      marginTop: Styles.globalMargins.xlarge,
    },
  }),
  mainText: {
    paddingBottom: Styles.globalMargins.small,
  },
  warningText: {
    color: Styles.globalColors.brown_60,
    textAlign: 'center',
  },
  toastText: {
    color: Styles.globalColors.white,
  },
})

export default Kb.HOCTimers(ReallyRemoveAccountPopup)
