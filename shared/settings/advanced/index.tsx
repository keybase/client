import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isMobile, isLinux, defaultUseNativeFrame} from '../../constants/platform'
import flags from '../../util/feature-flags'
// normally never do this but this call serves no purpose for users at all
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import AppState from '../../app/app-state'
import * as Types from '../../constants/types/wallets'
import {maxUsernameLength} from '../../constants/signup'

type Props = {
  openAtLogin: boolean
  lockdownModeEnabled: boolean | null
  onChangeLockdownMode: (arg0: boolean) => void
  onSetOpenAtLogin: (open: boolean) => void
  onDBNuke: () => void
  onDisableCertPinning: () => void
  onTrace: (durationSeconds: number) => void
  onProcessorProfile: (durationSeconds: number) => void
  onBack: () => void
  setLockdownModeError: string
  settingLockdownMode: boolean
  traceInProgress: boolean
  processorProfileInProgress: boolean
  proxyData: RPCTypes.ProxyData
  hasRandomPW: boolean
  useNativeFrame: boolean
  onChangeUseNativeFrame: (arg0: boolean) => void
  saveProxyData: (proxyData: RPCTypes.ProxyData) => void
  onEnableCertPinning: () => void
  allowTlsMitmToggle: boolean
}

const stateUseNativeFrame = new AppState().state.useNativeFrame
const initialUseNativeFrame =
  stateUseNativeFrame !== null && stateUseNativeFrame !== undefined
    ? stateUseNativeFrame
    : defaultUseNativeFrame

const UseNativeFrame = (props: Props) => {
  return (
    !isMobile && (
      <>
        <Kb.Box style={styles.checkboxContainer}>
          <Kb.Checkbox
            checked={!props.useNativeFrame}
            label={'Hide system window frame'}
            onCheck={x => props.onChangeUseNativeFrame(!x)}
            style={styles.checkbox}
          />
        </Kb.Box>
        {initialUseNativeFrame !== props.useNativeFrame && (
          <Kb.Text type="BodySmall" style={styles.error}>
            Keybase needs to restart for this change to take effect.
          </Kb.Text>
        )}
      </>
    )
  )
}

const Advanced = (props: Props) => {
  const disabled = props.lockdownModeEnabled == null || props.hasRandomPW || props.settingLockdownMode
  return (
    <Kb.ScrollView>
      <Kb.Box style={styles.advancedContainer}>
        <Kb.Box style={styles.progressContainer}>
          {props.settingLockdownMode && <Kb.ProgressIndicator />}
        </Kb.Box>
        <Kb.Box style={styles.checkboxContainer}>
          <Kb.Checkbox
            checked={props.hasRandomPW || !!props.lockdownModeEnabled}
            disabled={disabled}
            label={
              'Forbid account changes from the website' +
              (props.hasRandomPW ? ' (you need to set a password first)' : '')
            }
            onCheck={props.onChangeLockdownMode}
            style={styles.checkbox}
          />
        </Kb.Box>
        {!!props.setLockdownModeError && (
          <Kb.Text type="BodySmall" style={styles.error}>
            {props.setLockdownModeError}
          </Kb.Text>
        )}
        {isLinux && <UseNativeFrame {...props} />}
        {!Styles.isMobile && !isLinux && (
          <Kb.Box style={styles.openAtLoginCheckboxContainer}>
            <Kb.Checkbox
              label="Open Keybase on startup"
              checked={props.openAtLogin}
              onCheck={props.onSetOpenAtLogin}
            />
          </Kb.Box>
        )}
        <ProxySettings {...props} />
        <Developer {...props} />
      </Kb.Box>
    </Kb.ScrollView>
  )
}

type StartButtonProps = {
  label: string
  inProgress: boolean
  onStart: () => void
}

const StartButton = (props: StartButtonProps) => (
  <Kb.Button
    waiting={props.inProgress}
    style={{marginTop: Styles.globalMargins.small}}
    type="Danger"
    label={props.label}
    onClick={props.onStart}
  />
)

type State = {
  cleanTook: number
  clickCount: number
  indexTook: number
}

const clickThreshold = 7
const traceDurationSeconds = 30
const processorProfileDurationSeconds = 30

class Developer extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      cleanTook: -1,
      clickCount: 0,
      indexTook: -1,
    }
  }

  _onLabelClick = () => {
    this.setState(state => {
      const clickCount = state.clickCount + 1
      if (clickCount < clickThreshold) {
        console.log(
          `clickCount = ${clickCount} (${clickThreshold - clickCount} away from showing developer controls)`
        )
      }
      return {clickCount}
    })
  }

  _showPprofControls = () => {
    return this.state.clickCount >= clickThreshold
  }

  render() {
    const props = this.props
    return (
      <Kb.Box style={styles.developerContainer}>
        <Kb.Text center={true} type="BodySmallSemibold" onClick={this._onLabelClick} style={styles.text}>
          Please don't do anything below here unless instructed to by a developer.
        </Kb.Text>
        <Kb.Divider style={styles.divider} />
        <Kb.Button style={styles.developerButtons} type="Danger" label="DB Nuke" onClick={props.onDBNuke} />
        {this._showPprofControls() && (
          <React.Fragment>
            <StartButton
              label={`Trace (${traceDurationSeconds}s)`}
              onStart={() => props.onTrace(traceDurationSeconds)}
              inProgress={props.traceInProgress}
            />
            <StartButton
              label={`CPU Profile (${traceDurationSeconds}s)`}
              onStart={() => props.onProcessorProfile(processorProfileDurationSeconds)}
              inProgress={props.processorProfileInProgress}
            />
            <Kb.Text center={true} type="BodySmallSemibold" style={styles.text}>
              Trace and profile files are included in logs sent with feedback.
            </Kb.Text>
          </React.Fragment>
        )}
        {flags.chatIndexProfilingEnabled && (
          <Kb.Button
            label={`Chat Index: ${this.state.indexTook}ms`}
            onClick={() => {
              this.setState({indexTook: -1})
              const start = Date.now()
              RPCChatTypes.localProfileChatSearchRpcPromise({
                identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
              }).then(() => this.setState({indexTook: Date.now() - start}))
            }}
            mode="Secondary"
            style={styles.developerButtons}
          />
        )}
        {flags.dbCleanEnabled && (
          <Kb.Button
            label={`DB clean: ${this.state.cleanTook}ms`}
            onClick={() => {
              this.setState({cleanTook: -1})
              const start = Date.now()
              RPCTypes.ctlDbCleanRpcPromise({
                dbType: RPCTypes.DbType.main, // core db
                force: true,
              }).then(() => this.setState({cleanTook: Date.now() - start}))
            }}
            mode="Secondary"
            style={styles.developerButtons}
          />
        )}
        <Kb.Box style={styles.filler} />
      </Kb.Box>
    )
  }
}

// A list so the order of the elements is fixed
const proxyTypeList = ['noProxy', 'httpConnect', 'socks']
const proxyTypeToDisplayName = {
  httpConnect: 'HTTP Connect',
  noProxy: 'No Proxy',
  socks: 'Socks5',
}

type ProxyState = {
  address: string
  port: string
  proxyType: string
}

class ProxySettings extends React.Component<Props, ProxyState> {
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
        <Kb.Divider style={styles.proxyDivider} />
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

const styles = Styles.styleSheetCreate({
  advancedContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
    paddingBottom: Styles.globalMargins.medium,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
  checkbox: {
    flex: 1,
    paddingBottom: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
  },
  checkboxContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    maxHeight: 48,
    minHeight: 48,
  },
  developerButtons: {
    marginTop: Styles.globalMargins.small,
  },
  developerContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    paddingBottom: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.xlarge,
  },
  divider: {
    marginTop: Styles.globalMargins.xsmall,
    width: '100%',
  },
  error: {
    color: Styles.globalColors.redDark,
  },
  expandedProxyContainer: {
    marginTop: Styles.globalMargins.small,
  },
  filler: {
    flex: 1,
  },
  flexButtons: {
    display: 'flex',
    flexShrink: 0,
    flexWrap: 'wrap',
    marginTop: Styles.globalMargins.tiny,
  },
  openAtLoginCheckboxContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    flex: 1,
  },
  progressContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  proxyContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    paddingBottom: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.medium,
  },
  proxyDivider: {
    marginBottom: Styles.globalMargins.small,
    width: '100%',
  },
  proxySetting: {
    marginBottom: Styles.globalMargins.small,
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

export default Advanced
