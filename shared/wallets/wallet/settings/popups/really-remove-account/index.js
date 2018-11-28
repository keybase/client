// @flow
import React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {WalletPopup} from '../../../../common'

type Props = Kb.PropsWithTimer<{|
  name: string,
  loading: boolean,
  waiting: boolean,
  onCopyKey: () => void,
  onFinish: () => void,
  onCancel: () => void,
  onLoadSecretKey: () => void,
|}>

type State = {
  showingToast: boolean,
}

class ReallyRemoveAccountPopup extends React.Component<Props, State> {
  state = {
    showingToast: false,
  }
  _attachmentRef = React.createRef()

  componentDidMount() {
    this.props.onLoadSecretKey()
  }

  copy = () => {
    this.setState({showingToast: true}, () =>
      this.props.setTimeout(() => this.setState({showingToast: false}), 2000)
    )
    this.props.onCopyKey()
  }

  _getAttachmentRef = () => this._attachmentRef.current

  render() {
    return (
      <WalletPopup
        onExit={this.props.onCancel}
        backButtonType="cancel"
        containerStyle={styles.background}
        headerStyle={Styles.collapseStyles([styles.background, styles.header])}
        bottomButtons={[
          <Kb.Button
            fullWidth={Styles.isMobile}
            key={0}
            label="Copy secret key"
            onClick={this.copy}
            type="Wallet"
            ref={this._attachmentRef}
            waiting={this.props.loading}
            disabled={this.props.waiting}
          />,
          <Kb.Button
            fullWidth={Styles.isMobile}
            key={1}
            label="Finish"
            onClick={this.props.onFinish}
            type="Secondary"
            waiting={this.props.waiting}
            disabled={this.props.loading}
          />,
        ]}
      >
        <Kb.Box2 centerChildren={true} direction="vertical" style={styles.flexOne} fullWidth={true}>
          <Kb.Icon
            type={Styles.isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
            style={Kb.iconCastPlatformStyles(styles.icon)}
          />
          <Kb.Box2 direction="vertical">
            <Kb.Text style={styles.warningText} type="Header">
              One last thing! Make sure you keep a copy of your secret key before removing{' '}
            </Kb.Text>
            <Kb.Text type="HeaderItalic" style={Styles.collapseStyles([styles.warningText, styles.mainText])}>
              {this.props.name}.
            </Kb.Text>
          </Kb.Box2>
          <Kb.Text type="BodySmall" style={styles.warningText}>
            If you save this secret key, you can use it in other wallets outside Keybase, or even import it
            back into Keybase later.
          </Kb.Text>

          <Kb.Toast
            visible={this.state.showingToast}
            attachTo={this._getAttachmentRef}
            position={'top center'}
          >
            {Styles.isMobile && <Kb.Icon type="iconfont-clipboard" color="white" fontSize={22} />}
            <Kb.Text type="BodySmall" style={styles.toastText}>
              Copied to clipboard
            </Kb.Text>
          </Kb.Toast>
        </Kb.Box2>
      </WalletPopup>
    )
  }
}

const styles = Styles.styleSheetCreate({
  background: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.yellow,
    },
  }),
  flexOne: {flex: 1},
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
  mainText: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.small,
    },
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
  toastText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
      textAlign: 'center',
    },
    isMobile: {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 5,
    },
  }),
  warningText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.brown_60,
      textAlign: 'center',
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
  }),
})

export default Kb.HOCTimers(ReallyRemoveAccountPopup)
