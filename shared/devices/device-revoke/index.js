// @flow
import * as React from 'react'
import * as Constants from '../../constants/devices'
import * as Types from '../../constants/types/devices'
import * as Common from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  device: Types.Device,
  endangeredTLFs: Array<string>,
  onCancel: () => void,
  onSubmit: () => void,
  waiting: boolean,
}

class EndangeredTLFList extends React.Component<{endangeredTLFs: Array<string>}> {
  _renderTLFEntry = (index: number, tlf: string) => (
    <Common.Box2 direction="horizontal" key={index} gap="tiny" fullWidth={true} style={styles.row}>
      <Common.Text type="BodySemibold">•</Common.Text>
      <Common.Text type="BodySemibold" selectable={true} style={styles.tlf}>
        {tlf}
      </Common.Text>
    </Common.Box2>
  )
  render() {
    if (!this.props.endangeredTLFs.length) return null
    return (
      <React.Fragment>
        <Common.Text type="Body" style={styles.centerText}>
          You may lose access to these folders forever:
        </Common.Text>
        <Common.Box2 direction="vertical" style={styles.listContainer}>
          <Common.List
            items={this.props.endangeredTLFs}
            renderItem={this._renderTLFEntry}
            indexAsKey={true}
          />
        </Common.Box2>
      </React.Fragment>
    )
  }
}

const ActionButtons = ({onCancel, onSubmit}) => (
  <Common.Box2
    direction={Styles.isMobile ? 'vertical' : 'horizontalReverse'}
    fullWidth={Styles.isMobile}
    gap="tiny"
  >
    <Common.WaitingButton
      fullWidth={Styles.isMobile}
      type="Danger"
      label="Yes, delete it"
      waitingKey={Constants.waitingKey}
      onClick={onSubmit}
    />
    <Common.Button fullWidth={Styles.isMobile} type="Secondary" onClick={onCancel} label="Cancel" />
  </Common.Box2>
)

const DeviceRevoke = (props: Props) => {
  const icon: Common.IconType = {
    backup: Styles.isMobile ? 'icon-paper-key-revoke-64' : 'icon-paper-key-revoke-48',
    desktop: Styles.isMobile ? 'icon-computer-revoke-64' : 'icon-computer-revoke-48',
    mobile: Styles.isMobile ? 'icon-phone-revoke-64' : 'icon-phone-revoke-48',
  }[props.device.type]

  return (
    <Common.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      gap="small"
      gapEnd={true}
      style={styles.container}
    >
      <Common.NameWithIcon icon={icon} title={props.device.name} titleStyle={styles.headerName} />
      <Common.Text type="Header" style={styles.centerText}>
        Are you sure you want to revoke{' '}
        {props.device.currentDevice ? (
          'your current device'
        ) : (
          <Common.Text type="Header" style={styles.italicName}>
            {props.device.name}
          </Common.Text>
        )}
        ?
      </Common.Text>
      <Common.Box2 direction="vertical" style={styles.endangeredTLFContainer} fullWidth={Styles.isMobile}>
        {props.waiting ? (
          <Common.ProgressIndicator />
        ) : (
          <EndangeredTLFList endangeredTLFs={props.endangeredTLFs} />
        )}
      </Common.Box2>
      <ActionButtons onCancel={props.onCancel} onSubmit={props.onSubmit} />
    </Common.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  centerText: {textAlign: 'center'},
  container: {padding: Styles.globalMargins.small},
  endangeredTLFContainer: Styles.platformStyles({
    isElectron: {alignSelf: 'center'},
    isMobile: {flexGrow: 1},
  }),
  headerName: {
    color: Styles.globalColors.red,
    fontStyle: 'italic',
    marginTop: 4,
    textDecorationLine: 'line-through',
  },
  italicName: {...Styles.globalStyles.italic},
  listContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignContent: 'center',
      borderColor: Styles.globalColors.black_05,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      flexGrow: 1,
      marginBottom: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.small,
      width: '100%',
    },
    isElectron: {height: 162, width: 440},
  }),
  row: {
    paddingBottom: Styles.globalMargins.xxtiny,
    paddingLeft: Styles.globalMargins.xtiny,
    paddingTop: Styles.globalMargins.xxtiny,
  },
  tlf: Styles.platformStyles({
    isElectron: {wordBreak: 'break-word'},
  }),
})

export default Common.HeaderHoc(DeviceRevoke)
