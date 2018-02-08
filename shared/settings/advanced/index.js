// @flow
import * as React from 'react'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../styles'
import {Box, Button, Text, Checkbox} from '../../common-adapters'

type Props = {
  openAtLogin: boolean,
  onSetOpenAtLogin: (open: boolean) => void,
  onDBNuke: () => void,
  onTrace: (durationSeconds: number) => void,
  onBack: () => void,
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
  onTrace: (durationSeconds: number) => void,
}

type TraceButtonState = {
  enabled: boolean,
}

class TraceButton extends React.Component<TraceButtonProps, TraceButtonState> {
  state = {
    enabled: true,
  }

  _onClick = () => {
    this.setState({enabled: false})
    this.props.onTrace(this.props.durationSeconds)
    setTimeout(() => {
      this.setState({enabled: true})
    }, this.props.durationSeconds * 1000)
  }

  render() {
    const label = `Trace (${this.props.durationSeconds}s)`
    return (
      <Button
        disabled={!this.state.enabled}
        style={{marginTop: globalMargins.small}}
        type="Danger"
        label={label}
        onClick={this._onClick}
      />
    )
  }
}

function Developer(props: Props) {
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
      <Text type="BodySmallSemibold" style={{textAlign: 'center'}}>
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
      <TraceButton durationSeconds={30} onTrace={props.onTrace} />
      <Box style={{flex: 1}} />
    </Box>
  )
}

export default Advanced
