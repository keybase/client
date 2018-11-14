// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isLinux} from '../../constants/platform'
import flags from '../../util/feature-flags'
// normally never do this but this call serves no purpose for users at all
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'

type Props = {
  openAtLogin: boolean,
  lockdownModeEnabled: ?boolean,
  onChangeLockdownMode: boolean => void,
  onSetOpenAtLogin: (open: boolean) => void,
  onDBNuke: () => void,
  onTrace: (durationSeconds: number) => void,
  onProcessorProfile: (durationSeconds: number) => void,
  onBack: () => void,
  traceInProgress: boolean,
  processorProfileInProgress: boolean,
}

const Advanced = (props: Props) => (
  <Kb.Box style={styles.advancedContainer}>
    <Kb.Box style={styles.checkboxContainer}>
      <Kb.Checkbox
        checked={!!props.lockdownModeEnabled}
        disabled={props.lockdownModeEnabled == null}
        label="Forbid account changes from the website"
        onCheck={props.onChangeLockdownMode}
        style={styles.checkbox}
      />
    </Kb.Box>
    {!Styles.isMobile &&
      !isLinux && (
        <Kb.Box style={styles.openAtLoginCheckboxContainer}>
          <Kb.Checkbox
            label="Open Keybase on startup"
            checked={props.openAtLogin}
            onCheck={props.onSetOpenAtLogin}
          />
        </Kb.Box>
      )}
    <Developer {...props} />
  </Kb.Box>
)

type StartButtonProps = {
  label: string,
  inProgress: boolean,
  onStart: () => void,
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
  clickCount: number,
  indexTook: number,
}

const clickThreshold = 7
const traceDurationSeconds = 30
const processorProfileDurationSeconds = 30

class Developer extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
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
        <Kb.Text type="BodySmallSemibold" onClick={this._onLabelClick} style={styles.text}>
          {Styles.isMobile
            ? `Please don't do anything here unless instructed to by a developer.`
            : `Please don't do anything below here unless instructed to by a developer.`}
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
            <Kb.Text type="BodySmallSemibold" style={styles.text}>
              Trace and profile files are included in logs sent with feedback.
            </Kb.Text>
          </React.Fragment>
        )}
        {flags.chatIndexProfilingEnabled && (
          <Kb.Button
            type="Primary"
            label={`Chat Index: ${this.state.indexTook}ms`}
            onClick={() => {
              this.setState({indexTook: -1})
              const start = Date.now()
              RPCChatTypes.localProfileChatSearchRpcPromise({
                identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
              }).then(() => this.setState({indexTook: Date.now() - start}))
            }}
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
    paddingTop: Styles.globalMargins.xlarge,
    paddingBottom: Styles.globalMargins.medium,
  },
  divider: {
    marginTop: Styles.globalMargins.xsmall,
    width: '100%',
  },
  filler: {
    flex: 1,
  },
  openAtLoginCheckboxContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    flex: 1,
  },
  text: Styles.platformStyles({
    common: {
      textAlign: 'center',
    },
    isElectron: {
      cursor: 'default',
    },
  }),
})

export default Advanced
