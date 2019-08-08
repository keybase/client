import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isDarwin, isMobile, isLinux, defaultUseNativeFrame} from '../../constants/platform'
import flags from '../../util/feature-flags'
// normally never do this but this call serves no purpose for users at all
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import AppState from '../../app/app-state'
import {ProxySettings} from '../proxy/container'
import {DarkModePreference} from '../../styles/dark-mode'

type Props = {
  openAtLogin: boolean
  darkModePreference: DarkModePreference
  lockdownModeEnabled: boolean | null
  onChangeLockdownMode: (arg0: boolean) => void
  onSetOpenAtLogin: (open: boolean) => void
  onExtraKBFSLogging: () => void
  onDBNuke: () => void
  onDisableCertPinning: () => void
  onTrace: (durationSeconds: number) => void
  onProcessorProfile: (durationSeconds: number) => void
  onBack: () => void
  onSetDarkModePreference: (pref: DarkModePreference) => void
  setLockdownModeError: string
  settingLockdownMode: boolean
  traceInProgress: boolean
  processorProfileInProgress: boolean
  hasRandomPW: boolean
  useNativeFrame: boolean
  onChangeUseNativeFrame: (arg0: boolean) => void
  onEnableCertPinning: () => void
  allowTlsMitmToggle: boolean
  rememberPassword: boolean
  onChangeRememberPassword: (checked: boolean) => void
  onToggleRuntimeStats: () => void
}

const stateUseNativeFrame = new AppState().state.useNativeFrame
const initialUseNativeFrame =
  stateUseNativeFrame !== null && stateUseNativeFrame !== undefined
    ? stateUseNativeFrame
    : defaultUseNativeFrame

const UseNativeFrame = (props: Props) => {
  return !isMobile ? (
    <>
      <Kb.Box style={styles.checkboxContainer}>
        <Kb.Checkbox
          checked={!props.useNativeFrame}
          label={'Hide system window frame'}
          onCheck={x => props.onChangeUseNativeFrame(!x)}
        />
      </Kb.Box>
      {initialUseNativeFrame !== props.useNativeFrame && (
        <Kb.Text type="BodySmall" style={styles.error}>
          Keybase needs to restart for this change to take effect.
        </Kb.Text>
      )}
    </>
  ) : null
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
          />
        </Kb.Box>
        {!!props.setLockdownModeError && (
          <Kb.Text type="BodySmall" style={styles.error}>
            {props.setLockdownModeError}
          </Kb.Text>
        )}
        {!props.hasRandomPW && (
          <Kb.Box style={styles.checkboxContainer}>
            <Kb.Checkbox
              checked={props.rememberPassword}
              labelComponent={
                <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne}>
                  <Kb.Text type="Body">Always stay logged in</Kb.Text>
                  <Kb.Text type="BodySmall">
                    You won't be asked for your password when restarting the app or your device.
                  </Kb.Text>
                </Kb.Box2>
              }
              onCheck={props.onChangeRememberPassword}
            />
          </Kb.Box>
        )}
        {isLinux ? <UseNativeFrame {...props} /> : null}
        {!Styles.isMobile && !isLinux && (
          <Kb.Box style={styles.checkboxContainer}>
            <Kb.Checkbox
              label="Open Keybase on startup"
              checked={props.openAtLogin}
              onCheck={props.onSetOpenAtLogin}
            />
          </Kb.Box>
        )}
        <Kb.Divider style={styles.proxyDivider} />
        <ProxySettings />
        {flags.darkMode && (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Divider style={styles.proxyDivider} />
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="Body">Dark mode</Kb.Text>
              <Kb.Checkbox
                label="Respect system settings"
                disabled={!isDarwin}
                checked={props.darkModePreference === 'system' || props.darkModePreference === undefined}
                onCheck={() => props.onSetDarkModePreference('system')}
              />
              <Kb.Checkbox
                label="Dark all the time"
                checked={props.darkModePreference === 'alwaysDark'}
                onCheck={() => props.onSetDarkModePreference('alwaysDark')}
              />
              <Kb.Checkbox
                label="Light all the time 😎"
                checked={props.darkModePreference === 'alwaysLight'}
                onCheck={() => props.onSetDarkModePreference('alwaysLight')}
              />
            </Kb.Box2>
          </Kb.Box2>
        )}
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
        <Kb.Button
          style={styles.developerButtons}
          mode="Secondary"
          label="Enable Detailed Logging"
          onClick={props.onExtraKBFSLogging}
        />
        {this._showPprofControls() && (
          <React.Fragment>
            <Kb.Button
              label="Toggle Runtime Stats"
              onClick={this.props.onToggleRuntimeStats}
              mode="Secondary"
              style={styles.developerButtons}
            />
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

const styles = Styles.styleSheetCreate({
  advancedContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
    paddingBottom: Styles.globalMargins.medium,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
    width: '100%',
  },
  checkboxContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
    width: '100%',
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
  filler: {
    flex: 1,
  },
  progressContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  proxyDivider: {
    marginBottom: Styles.globalMargins.small,
    width: '100%',
  },
  text: Styles.platformStyles({
    isElectron: {
      cursor: 'default',
    },
  }),
})

export default Advanced
