import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as T from '../../constants/types'

// A list so the order of the elements is fixed
const proxyTypeList = ['noProxy', 'httpConnect', 'socks'] as const
const proxyTypeToDisplayName = {
  httpConnect: 'HTTP(s) Connect',
  noProxy: 'No proxy',
  socks: 'SOCKS5',
}

type State = {
  address: string
  port: string
  proxyType: 'noProxy' | 'httpConnect' | 'socks'
}

type Props = {
  loadProxyData: () => void
  resetCertPinningToggle: () => void
  allowTlsMitmToggle?: boolean
  onBack: () => void
  onDisableCertPinning: () => void
  onEnableCertPinning: () => void
  proxyData?: T.RPCGen.ProxyData
  saveProxyData: (proxyData: T.RPCGen.ProxyData) => void
}

class ProxySettings extends React.Component<Props, State> {
  state = {
    address: '',
    port: '',
    proxyType: 'noProxy' as const,
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.proxyData !== this.props.proxyData) {
      if (!this.props.proxyData) {
        return
      }
      const addressPort = this.props.proxyData.addressWithPort.split(':')
      if (!addressPort) return
      const address = addressPort.slice(0, addressPort.length - 1).join(':')
      let port = '8080'
      if (addressPort.length >= 2) {
        port = addressPort.at(-1) ?? ''
      }

      const proxyType = T.RPCGen.ProxyType[this.props.proxyData.proxyType] as State['proxyType']
      this.setState({address, port, proxyType})
    }
  }

  componentDidMount() {
    this.props.loadProxyData()
  }

  componentWillUnmount() {
    this.props.resetCertPinningToggle()
  }

  toggleCertPinning = () => {
    if (this.certPinning()) {
      this.props.onDisableCertPinning()
    } else {
      this.props.onEnableCertPinning()
    }
  }

  saveProxySettings = () => {
    const proxyData = {
      addressWithPort: this.state.address + ':' + this.state.port,
      certPinning: this.certPinning(),
      proxyType: T.RPCGen.ProxyType[this.state.proxyType],
    }
    this.props.saveProxyData(proxyData)
  }

  certPinning = (): boolean => {
    if (this.props.allowTlsMitmToggle === undefined) {
      if (this.props.proxyData) {
        return this.props.proxyData.certPinning
      } else {
        return true // Default value
      }
    } else {
      return !this.props.allowTlsMitmToggle
    }
  }

  proxyTypeSelected = (proxyType: State['proxyType']) => {
    let cb = () => {}
    if (proxyType === 'noProxy') {
      // Setting the proxy type to no proxy collapses the menu including the save button, so save immediately
      cb = this.saveProxySettings
    }
    this.setState({proxyType}, cb)
  }

  render() {
    return (
      <>
        <Kb.Text type="Header" style={styles.text}>
          Proxy settings
        </Kb.Text>
        {proxyTypeList.map(proxyType => (
          <Kb.RadioButton
            onSelect={() => this.proxyTypeSelected(proxyType)}
            selected={this.state.proxyType === proxyType}
            key={proxyType}
            label={proxyTypeToDisplayName[proxyType] ?? ''}
            style={styles.radioButton}
          />
        ))}
        {this.state.proxyType === 'noProxy' ? null : (
          <>
            <Kb.Text type="BodySmall">Proxy Address</Kb.Text>
            <Kb.NewInput
              placeholder="127.0.0.1"
              onChangeText={address => this.setState({address})}
              value={this.state.address}
            />
            <Kb.Text type="BodySmall">Proxy Port</Kb.Text>
            <Kb.NewInput
              placeholder="8080"
              onChangeText={port => this.setState({port})}
              value={this.state.port}
            />
            <Kb.Checkbox
              checked={!this.certPinning()}
              onCheck={this.toggleCertPinning}
              label="Allow TLS Interception"
              style={styles.proxySetting}
            />
            <Kb.Button onClick={this.saveProxySettings} label="Save Proxy Settings" />
          </>
        )}
      </>
    )
  }
}

// TODO liklely use PopupWrapper
const ProxySettingsPopup = (props: Props) => {
  if (Styles.isMobile) {
    return (
      <Kb.HeaderHocWrapper onBack={props.onBack}>
        <Kb.Box style={styles.popupBox}>
          <Kb.Box style={styles.proxySettingPopupBox}>
            <ProxySettings {...props} />
          </Kb.Box>
        </Kb.Box>
      </Kb.HeaderHocWrapper>
    )
  }
  return (
    <Kb.PopupDialog>
      <Kb.Box style={styles.popupBox}>
        <Kb.BackButton onClick={props.onBack} />
        <Kb.Box style={styles.proxySettingPopupBox}>
          <ProxySettings {...props} />
        </Kb.Box>
      </Kb.Box>
    </Kb.PopupDialog>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  divider: {
    marginTop: Styles.globalMargins.xsmall,
    width: '100%',
  },
  flexButtons: {
    display: 'flex',
    flexShrink: 0,
    flexWrap: 'wrap',
    marginTop: Styles.globalMargins.tiny,
  },
  popupBox: {
    minHeight: '40%',
    padding: Styles.globalMargins.small,
  },
  proxyContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    paddingBottom: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.medium,
  },
  proxySetting: {
    marginBottom: Styles.globalMargins.small,
  },
  proxySettingPopupBox: {
    padding: Styles.globalMargins.xlarge,
  },
  radioButton: {
    marginRight: Styles.globalMargins.medium,
  },
  text: Styles.platformStyles({
    isElectron: {
      cursor: 'default',
    },
  }),
}))

export {ProxySettings, ProxySettingsPopup}
