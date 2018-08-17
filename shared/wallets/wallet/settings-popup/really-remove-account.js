// @flow
import React from 'react'
import * as Kb from '../../../common-adapters'
import {globalColors, globalStyles, globalMargins, isMobile, styleSheetCreate} from '../../../styles'
import WalletModal from '../../wallet-modal'

type Props = Kb.PropsWithTimer<{
  name: string,
  onCopyKey: () => void,
  onClose: () => void,
}>

type State = {
  showingToast: boolean,
}

class RemoveAccountReally extends React.Component<Props, State> {
  state = {
    showingToast: false,
  }
  _attachmentRef = null

  copy = () => {
    this.setState({showingToast: true}, () =>
      this.props.setTimeout(() => this.setState({showingToast: false}), 2000)
    )
    this.props.onCopyKey()
  }

  render() {
    return (
      <WalletModal
        onClose={this.props.onClose}
        containerStyle={styles.container}
        bottomButtons={[
          <Kb.Button
            key={0}
            label="Copy secret key"
            onClick={this.copy}
            type="Wallet"
            ref={r => (this._attachmentRef = r)}
          >
            <Kb.Toast
              visible={this.state.showingToast}
              attachTo={this._attachmentRef}
              position={'top center'}
            >
              <Kb.Text type="BodySmall" style={styles.text}>
                Copied to clipboard
              </Kb.Text>
            </Kb.Toast>
          </Kb.Button>,
          <Kb.Button key={1} label="Cancel" onClick={this.props.onClose} type="Secondary" />,
        ]}
      >
        <Kb.Icon
          type={isMobile ? 'icon-wallet-secret-key-64' : 'icon-wallet-secret-key-48'}
          style={Kb.iconCastPlatformStyles(styles.icon)}
        />
        <Kb.Text style={styles.warning} type="Header">
          One last thing! Make sure you keep a copy of your secret key before removing{' '}
          <Kb.Text type="Header" style={styles.italic}>
            {this.props.name}
          </Kb.Text>.
        </Kb.Text>
        <Kb.Text type="BodySmall">Paste it in a 100% safe place.</Kb.Text>
      </WalletModal>
    )
  }
}

const styles = styleSheetCreate({
  container: {
    backgroundColor: globalColors.yellow,
  },
  icon: {
    marginBottom: globalMargins.small,
  },
  italic: {
    fontStyle: 'italic',
  },
  box: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    padding: globalMargins.large,
    backgroundColor: globalColors.yellow,
  },
  warning: {
    paddingBottom: globalMargins.medium,
    paddingTop: globalMargins.xtiny,
    textAlign: 'center',
  },
  buttonbar: {
    paddingTop: globalMargins.large,
  },
  text: {
    color: globalColors.white,
  },
  toast: {
    borderRadius: 20,
  },
})

export default Kb.HOCTimers(RemoveAccountReally)
