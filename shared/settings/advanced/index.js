// @flow
import * as React from 'react'
import {globalStyles, globalMargins, isMobile, platformStyles, styleSheetCreate} from '../../styles'
import {Box, Button, Checkbox, Divider, Text} from '../../common-adapters'
import {isLinux} from '../../constants/platform'

type Props = {
  touchIDEnabled: boolean,
  touchIDAllowedBySystem: string,
  onSetTouchIDEnabled: boolean => void,
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
  <Box style={styles.advancedContainer}>
    <Box style={styles.checkboxContainer}>
      <Checkbox
        checked={!!props.lockdownModeEnabled}
        disabled={props.lockdownModeEnabled == null}
        label="Forbid account changes from the website"
        onCheck={props.onChangeLockdownMode}
        style={styles.checkbox}
      />
    </Box>
    {!isMobile &&
      !isLinux && (
        <Box style={styles.openAtLoginCheckboxContainer}>
          <Checkbox
            label="Open Keybase on startup"
            checked={props.openAtLogin}
            onCheck={props.onSetOpenAtLogin}
          />
        </Box>
      )}
    {isMobile &&
      !!props.touchIDAllowedBySystem && (
        <Checkbox
          label={`Require ${props.touchIDAllowedBySystem} on app start`}
          onCheck={props.onSetTouchIDEnabled}
          checked={props.touchIDEnabled}
        />
      )}
    <Developer {...props} />
  </Box>
)

type StartButtonProps = {
  label: string,
  inProgress: boolean,
  onStart: () => void,
}

const StartButton = (props: StartButtonProps) => (
  <Button
    waiting={props.inProgress}
    style={{marginTop: globalMargins.small}}
    type="Danger"
    label={props.label}
    onClick={props.onStart}
  />
)

type DeveloperState = {
  clickCount: number,
}

const clickThreshold = 7
const traceDurationSeconds = 30
const processorProfileDurationSeconds = 30

class Developer extends React.Component<Props, DeveloperState> {
  constructor(props: Props) {
    super(props)

    this.state = {
      clickCount: 0,
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
      <Box style={styles.developerContainer}>
        <Text type="BodySmallSemibold" onClick={this._onLabelClick} style={styles.text}>
          {isMobile
            ? `Please don't do anything here unless instructed to by a developer.`
            : `Please don't do anything below here unless instructed to by a developer.`}
        </Text>
        <Divider style={styles.divider} />
        <Button
          style={{marginTop: globalMargins.small}}
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
            <Text type="BodySmallSemibold" style={styles.text}>
              Trace and profile files are included in logs sent with feedback.
            </Text>
          </React.Fragment>
        )}
        <Box style={styles.filler} />
      </Box>
    )
  }
}

const styles = styleSheetCreate({
  advancedContainer: {
    ...globalStyles.flexBoxColumn,
    flex: 1,
    paddingBottom: globalMargins.medium,
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
  },
  checkbox: {
    flex: 1,
    paddingBottom: globalMargins.small,
    paddingTop: globalMargins.small,
  },
  checkboxContainer: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    minHeight: 48,
  },
  developerContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    paddingTop: globalMargins.xlarge,
    paddingBottom: globalMargins.medium,
  },
  divider: {
    marginTop: globalMargins.xsmall,
    width: '100%',
  },
  filler: {
    flex: 1,
  },
  openAtLoginCheckboxContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    flex: 1,
  },
  text: platformStyles({
    common: {
      textAlign: 'center',
    },
    isElectron: {
      cursor: 'default',
    },
  }),
})

export default Advanced
