// @flow
import * as React from 'react'
import {globalStyles, globalMargins, globalColors, isMobile, platformStyles} from '../../styles'
import {Box, Button, Text, Checkbox} from '../../common-adapters'

type Props = {
  openAtLogin: boolean,
  onSetOpenAtLogin: (open: boolean) => void,
  onDBNuke: () => void,
  onTrace: (durationSeconds: number) => void,
  onBack: () => void,
  traceInProgress: boolean,
}

const Advanced = (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      flex: 1,
      padding: globalMargins.medium,
    }}
  >
    {!isMobile && (
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

type TraceButtonProps = {
  durationSeconds: number,
  traceInProgress: boolean,
  onTrace: (durationSeconds: number) => void,
}

class TraceButton extends React.Component<TraceButtonProps> {
  _onClick = () => {
    this.props.onTrace(this.props.durationSeconds)
  }

  render() {
    const label = `Trace (${this.props.durationSeconds}s)`
    return (
      <Button
        waiting={this.props.traceInProgress}
        style={{marginTop: globalMargins.small}}
        type="Danger"
        label={label}
        onClick={this._onClick}
      />
    )
  }
}

type DeveloperState = {
  clickCount: number,
}

const clickThreshold = 7

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

  _showTrace = () => {
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
        {this._showTrace() && (
          <TraceButton durationSeconds={30} onTrace={props.onTrace} traceInProgress={props.traceInProgress} />
        )}
        {this._showTrace() && (
          <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
            Trace files are included in logs sent with feedback.
          </Text>
        )}
        <Box style={{flex: 1}} />
      </Box>
    )
  }
}

export default Advanced
