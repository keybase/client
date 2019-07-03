import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import {_Device} from '../constants/types/unlock-folders'

export type Props = {
  devices: Array<_Device> | null
  toPaperKeyInput: () => void
}

class DeviceRow extends React.Component<{device: _Device}> {
  render() {
    const icon = ({
      backup: 'icon-paper-key-32',
      desktop: 'icon-computer-32',
      mobile: 'icon-phone-32',
    } as const)[this.props.device.type]

    return (
      <div style={{...Styles.globalStyles.flexBoxRow, marginBottom: 16}}>
        <div style={deviceRowStyles.iconWrapper}>
          <Kb.Icon type={icon} style={{height: 22}} />
        </div>
        <Kb.Text type="BodySemibold" style={{marginLeft: 16}}>
          {this.props.device.name}
        </Kb.Text>
      </div>
    )
  }
}

export default class DeviceList extends React.Component<Props> {
  render() {
    return (
      <div style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Kb.Text center={true} type="Body" style={styles.infoText}>
          This computer and possibly others are unable to read some of your folders. To avoid losing data
          forever, please turn on one of the devices below:
        </Kb.Text>
        <div style={styles.devicesContainer}>
          {this.props.devices && this.props.devices.map(d => <DeviceRow key={d.deviceID} device={d} />)}
        </div>
        <div style={styles.buttonsContainer}>
          <Kb.Button
            type="Dim"
            label="Enter a paper key instead"
            style={styles.enterPaperKey}
            onClick={this.props.toPaperKeyInput}
          />
        </div>
      </div>
    )
  }
}

const styles = Styles.styleSheetCreate({
  accessFolders: {
    marginRight: 0,
  },
  buttonsContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignSelf: 'center',
    marginRight: 30,
    marginTop: Styles.globalMargins.small,
  },
  devicesContainer: {
    alignSelf: 'center',
    backgroundColor: Styles.globalColors.greyLight,
    height: 162,
    overflowY: 'scroll' as const,
    paddingBottom: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.small,
    width: 440,
  },
  enterPaperKey: {
    height: 32,
    marginRight: 7,
    width: 236,
  },
  infoText: {
    marginBottom: 8,
    marginTop: 5,
    paddingLeft: 55,
    paddingRight: 55,
  },
})

const deviceRowStyles = {
  iconWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginLeft: 33,
    width: 24,
  },
}
