import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RPCTypes from '../../constants/types/rpc-gen'

// A list so the order of the elements is fixed
const proxyTypeList = ['noProxy', 'httpConnect', 'socks']
const proxyTypeToDisplayName = {
  httpConnect: 'HTTP(s) Connect',
  noProxy: 'No proxy',
  socks: 'SOCKS5',
}

type State = {
  address: string
  port: string
  proxyType: string
}

type Props = {
  _loadProxyData: () => void
  _resetCertPinningToggle: () => void
  allowTlsMitmToggle: boolean | null
  onBack: () => void
  onDisableCertPinning: () => void
  onEnableCertPinning: () => void
  proxyData: RPCTypes.ProxyData
  saveProxyData: (proxyData: RPCTypes.ProxyData) => void
}

class ProxySettings extends React.Component<Props, State> {
  state = {
    address: '',
    port: '',
    proxyType: 'noProxy',
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.proxyData !== this.props.proxyData) {
      const addressPort = this.props.proxyData.addressWithPort.split(':')
      const address = addressPort.slice(0, addressPort.length - 1).join(':')
      var port = '8080'
      if (addressPort.length >= 2) {
        port = addressPort[addressPort.length - 1]
      }

      const proxyType = RPCTypes.ProxyType[this.props.proxyData.proxyType]
      this.setState({address, port, proxyType})
    }
  }

  componentDidMount() {
    this.props._loadProxyData()
  }

  componentWillUnmount() {
    this.props._resetCertPinningToggle()
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
      proxyType: (RPCTypes.ProxyType[this.state.proxyType] as unknown) as RPCTypes.ProxyType,
    }
    this.props.saveProxyData(proxyData)
  }

  certPinning = (): boolean => {
    if (this.props.allowTlsMitmToggle === null) {
      if (this.props.proxyData) {
        return this.props.proxyData.certPinning
      } else {
        return true // Default value
      }
    } else {
      return !this.props.allowTlsMitmToggle
    }
  }

  proxyTypeSelected = (proxyType: string) => {
    var cb = () => {}
    if (proxyType === 'noProxy') {
      // Setting the proxy type to no proxy collapses the menu including the save button, so save immediately
      cb = this.saveProxySettings
    }
    this.setState({proxyType}, cb)
  }

  renderProxySettings() {
    if (this.state.proxyType === 'noProxy') {
      return null
    }
    return (
      <Kb.Box direction="vertical" style={styles.expandedProxyContainer}>
        <Kb.Box2 direction="vertical" gap="tiny" style={styles.proxySetting}>
          <Kb.Text type="BodySmall">Proxy Address</Kb.Text>
          <Kb.NewInput
            placeholder="127.0.0.1"
            onChangeText={address => this.setState({address})}
            value={this.state.address}
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" gap="tiny" style={styles.proxySetting}>
          <Kb.Text type="BodySmall">Proxy Port</Kb.Text>
          <Kb.NewInput
            placeholder="8080"
            onChangeText={port => this.setState({port})}
            value={this.state.port}
          />
        </Kb.Box2>
        <Kb.Checkbox
          checked={!this.certPinning()}
          onCheck={this.toggleCertPinning}
          label="Allow TLS Interception"
          style={styles.proxySetting}
        />
        <Kb.Button onClick={this.saveProxySettings} label="Save Proxy Settings" />
      </Kb.Box>
    )
  }

  render() {
    return (
      <Kb.Box style={styles.proxyContainer}>
        <Kb.Text type="BodyBig" style={styles.text}>
          Proxy Settings
        </Kb.Text>
        <Kb.Box style={styles.flexButtons}>
          {proxyTypeList.map(proxyType => (
            <Kb.RadioButton
              onSelect={() => this.proxyTypeSelected(proxyType)}
              selected={this.state.proxyType === proxyType}
              key={proxyType}
              label={proxyTypeToDisplayName[proxyType]}
              style={styles.radioButton}
            />
          ))}
        </Kb.Box>
        {this.renderProxySettings()}
      </Kb.Box>
    )
  }
}

const ProxySettingsPopup = (props: Props) => {
  if (Styles.isMobile) {
    return (
      <Kb.Box style={styles.popupBox}>
        <Kb.Box style={styles.proxySettingPopupBox}>
          <ProxySettings {...props} />
        </Kb.Box>
      </Kb.Box>
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

const styles = Styles.styleSheetCreate({
  divider: {
    marginTop: Styles.globalMargins.xsmall,
    width: '100%',
  },
  expandedProxyContainer: {
    marginTop: Styles.globalMargins.small,
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
})

export {ProxySettings, ProxySettingsPopup}
