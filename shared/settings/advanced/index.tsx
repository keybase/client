import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isMobile, isLinux, defaultUseNativeFrame} from '../../constants/platform'
import flags from '../../util/feature-flags'
// normally never do this but this call serves no purpose for users at all
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import AppState from '../../app/app-state'
import * as rpc from "../../constants/types/rpc-gen";
import {ProxyType} from "../../constants/types/rpc-gen";
import * as Types from "../../constants/types/fs";

type Props = {
  openAtLogin: boolean
  lockdownModeEnabled: boolean | null
  onChangeLockdownMode: (arg0: boolean) => void
  onSetOpenAtLogin: (open: boolean) => void
  onDBNuke: () => void
  onTrace: (durationSeconds: number) => void
  onProcessorProfile: (durationSeconds: number) => void
  onBack: () => void
  setLockdownModeError: string
  settingLockdownMode: boolean
  traceInProgress: boolean
  processorProfileInProgress: boolean
  hasRandomPW: boolean
  useNativeFrame: boolean
  onChangeUseNativeFrame: (arg0: boolean) => void
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

type AdvancedState = {
  showCertPinningModal: boolean
  disableCertPinning: () => void | undefined
}

class Advanced extends React.Component<Props, AdvancedState>  {
  constructor(props: Props) {
    super(props)

    this.state = {
      showCertPinningModal: false,
      disableCertPinning: undefined
    }
  }

  confirmDisableCertPinning = (disableCertPinning: () => void) => {
    this.setState({disableCertPinning, showCertPinningModal: true})
  }

  render() {
    const disabled = this.props.lockdownModeEnabled == null || this.props.hasRandomPW || this.props.settingLockdownMode
    return (
      <Kb.Box style={styles.advancedContainer}>

        {this.state.showCertPinningModal && <Kb.Box style={{zIndex: 1}}> <Kb.ConfirmModal
            confirmText="Yes, allow TLS MITM"
            description="This means your proxy will be able to view all traffic between you and Keybase servers. It
          is not recommended to use this option unless absolutely required."
            header={<Kb.Icon type="iconfont-exclamation" sizeType="Big" color={Styles.globalColors.red}/>}
            onCancel={() => this.setState({showCertPinningModal: false})}
            onConfirm={() => {this.setState({showCertPinningModal: false}); this.state.disableCertPinning()}}
            prompt="Are you sure you want to allow TLS MITM?"
        /></Kb.Box>}

        <Kb.Box style={styles.progressContainer}>
          {this.props.settingLockdownMode && <Kb.ProgressIndicator/>}
        </Kb.Box>
        <Kb.Box style={styles.checkboxContainer}>
          <Kb.Checkbox
              checked={this.props.hasRandomPW || !!this.props.lockdownModeEnabled}
              disabled={disabled}
              label={
                'Forbid account changes from the website' +
                (this.props.hasRandomPW ? ' (you need to set a password first)' : '')
              }
              onCheck={this.props.onChangeLockdownMode}
              style={styles.checkbox}
          />
        </Kb.Box>
        {!!this.props.setLockdownModeError && (
            <Kb.Text type="BodySmall" style={styles.error}>
              {this.props.setLockdownModeError}
            </Kb.Text>
        )}
        {isLinux && <UseNativeFrame {...this.props} />}
        {!Styles.isMobile && !isLinux && (
            <Kb.Box style={styles.openAtLoginCheckboxContainer}>
              <Kb.Checkbox
                  label="Open Keybase on startup"
                  checked={this.props.openAtLogin}
                  onCheck={this.props.onSetOpenAtLogin}
              />
            </Kb.Box>
        )}
        <ProxySettings {...{...this.props, confirmDisableCertPinning: this.confirmDisableCertPinning}} />
        <Developer {...this.props} />
      </Kb.Box>
    )
  }
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
        <Kb.Button
          style={{marginTop: Styles.globalMargins.small}}
          type="Danger"
          label="DB Nuke"
          onClick={props.onDBNuke}
        />
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
          />
        )}
        <Kb.Box style={styles.filler} />
      </Kb.Box>
    )
  }
}

const ProxyTypeToDisplayName = {
  "noProxy": "No Proxy",
  "httpConnect": "HTTP Connect",
  "socks": "Socks5"
}
const DisplayNameToProxyType = {
  "No Proxy": "noProxy",
  "HTTP Connect": "httpConnect",
  "Socks5": "socks"
}

type ProxyState = {
  address: string
  port: string
  proxyType: string
  certPinning: boolean
  showCertPinningConfirmationModal: boolean
}

type ProxyProps = Props & {confirmDisableCertPinning: ((disableCertPinning: () => void) => void)}

class ProxySettings extends React.Component<ProxyProps, ProxyState> {
  constructor(props: ProxyProps) {
    super(props)

    this.state = {
      address: "",
      port: "",
      proxyType: ProxyTypeToDisplayName["noProxy"],
      certPinning: true,
      showCertPinningConfirmationModal: false
    }

    RPCTypes.configGetProxyDataRpcPromise()
        .then(this.handleProxyData)
        .catch(error => console.warn('Error in retrieving proxy data, using default data:', error))
  }

  handleProxyData = (data: rpc.ProxyData) => {
    var addressPort = data.addressWithPort.split(":")
    var address = addressPort[0]
    if (addressPort.length >= 2) {
      var port = addressPort[1]
    } else {
      var port = "80"
    }

    var certPinning = data.certPinning

    var proxyType = ProxyTypeToDisplayName[rpc.ProxyType[data.proxyType]]

    this.setState({address, port, certPinning, proxyType})
  }

  handleAddressChange = (address: string) => {
    this.setState({address})
  }

  handlePortChange = (port: string) => {
    this.setState({port})
  }

  setProxyType = (proxyType: string) => {
    this.setState({proxyType})
  }

  toggleCertPinning = () => {
    if (this.state.certPinning) {
      this.props.confirmDisableCertPinning(() => this.setState({certPinning: false}))
    } else {
      this.setState({certPinning: !this.state.certPinning})
    }
  }

  saveProxySettings = () => {
    var proxyData = {
      addressWithPort: this.state.address + ":" + this.state.port,
      proxyType: rpc.ProxyType[DisplayNameToProxyType[this.state.proxyType]] as unknown as ProxyType,
      certPinning: this.state.certPinning,
    }
    RPCTypes.configSetProxyDataRpcPromise({ proxyData })
        .catch(error => console.warn('Error in saving proxy data:', error))
  }

  render() {
    return (
        <Kb.Box style={styles.proxyContainer}>
          <Kb.Divider style={styles.divider} />
          <Kb.Text center={true} type="BodySmallSemibold" style={styles.text}>
            Configure a HTTP(s) or SOCKS5 proxy
          </Kb.Text>
          <Kb.Box>
            {
              Object.values(ProxyTypeToDisplayName).map(proxyType =>
                <Kb.Button
                  style={{margin: Styles.globalMargins.tiny}}
                  onClick={() => this.setProxyType(proxyType)}
                  type={this.state.proxyType == proxyType ? 'Default' : 'Dim'}
                >
                  {proxyType}
                </Kb.Button>
              )
            }
          </Kb.Box>
          <Kb.Box2 direction="vertical" centerChildren={true} style={{margin: Styles.globalMargins.mediumLarge}}>
            <Kb.Input
              hintText="Proxy Address"
              value={this.state.address}
              onChangeText={addr => this.handleAddressChange(addr)}
              style={{width: 400, margin: Styles.globalMargins.medium}}
            />
            <Kb.Input
              hintText="Proxy Port"
              value={this.state.port}
              onChangeText={port => this.handlePortChange(port)}
              style={{width: 200, margin: Styles.globalMargins.medium}}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" centerChildren={true} style={{marginTop: Styles.globalMargins.xlarge, marginBottom: Styles.globalMargins.medium}}>
            <Kb.Switch
              on={!this.state.certPinning}
              onClick={this.toggleCertPinning}
              label="Allow TLS Interception"
            />
            <Kb.Text center={true} type="BodySmallSemibold" style={styles.text}>
              Warning: Do not allow TLS interception unless you are using a proxy that requires it
            </Kb.Text>
          </Kb.Box2>
          <Kb.Button
            style={{margin: Styles.globalMargins.xsmall}}
            onClick={this.saveProxySettings}>
            Save Proxy Settings
          </Kb.Button>

        </Kb.Box>
    );
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
    minHeight: 48,
  },
  developerContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    paddingBottom: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.xlarge,
  },
  proxyContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    paddingBottom: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.large,
  },
  divider: {
    marginTop: Styles.globalMargins.xsmall,
    width: '100%',
  },
  error: {
    color: Styles.globalColors.red,
  },
  filler: {
    flex: 1,
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
  text: Styles.platformStyles({
    isElectron: {
      cursor: 'default',
    },
  }),
})

export default Advanced
