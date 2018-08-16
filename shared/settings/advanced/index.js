// @flow
import * as React from 'react'
import {globalStyles, globalMargins, globalColors, isMobile, platformStyles} from '../../styles'
import {Box, Button, Text, Checkbox} from '../../common-adapters'
import {isLinux} from '../../constants/platform'

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
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      flex: 1,
      paddingLeft: globalMargins.medium,
      paddingRight: globalMargins.medium,
      paddingBottom: globalMargins.medium,
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, minHeight: 48, alignItems: 'center'}}>
      <Checkbox
        checked={!!props.lockdownModeEnabled}
        disabled={props.lockdownModeEnabled == null}
        label="Forbid account changes from the website"
        onCheck={props.onChangeLockdownMode}
        style={{paddingTop: globalMargins.small, paddingBottom: globalMargins.small, flex: 1}}
      />
    </Box>
    {!isMobile &&
      !isLinux && (
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            alignItems: 'left',
            flex: 1,
          }}
        >
          <Checkbox
            label="Open Keybase on startup"
            checked={props.openAtLogin}
            onCheck={props.onSetOpenAtLogin}
          />
        </Box>
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
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          paddingTop: globalMargins.xlarge,
          paddingBottom: globalMargins.medium,
          flex: 1,
        }}
      >
        <Text
          type="BodySmallSemibold"
          onClick={this._onLabelClick}
          style={platformStyles({
            common: {
              textAlign: 'center',
            },
            isElectron: {
              cursor: 'default',
            },
          })}
        >
          {isMobile
            ? `Please don't do anything here unless instructed to by a developer.`
            : `Please don't do anything below here unless instructed to by a developer.`}
        </Text>
        <Box style={{width: '100%', height: 2, backgroundColor: globalColors.grey}} />
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
            <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
              Trace and profile files are included in logs sent with feedback.
            </Text>
          </React.Fragment>
        )}
        <Box style={{flex: 1}} />
      </Box>
    )
  }
}

export default Advanced
