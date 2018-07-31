// @flow
import * as React from 'react'
import * as Constants from '../../constants/devices'
import * as Types from '../../constants/types/devices'
import * as Kb from '../../common-adapters'
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
    <Kb.Box2 direction="horizontal" key={index} gap="tiny" fullWidth={true} style={styles.row}>
      <Kb.Text type="BodySemibold">•</Kb.Text>
      <Kb.Text type="BodySemibold" selectable={true} style={styles.tlf}>
        {tlf}
      </Kb.Text>
    </Kb.Box2>
  )
  render() {
    if (!this.props.endangeredTLFs.length) return null
    return (
      <React.Fragment>
        <Kb.Text type="Body" style={styles.centerText}>
          You may lose access to these folders forever:
        </Kb.Text>
        <Kb.Box2 direction="vertical" style={styles.listContainer}>
          <Kb.List items={this.props.endangeredTLFs} renderItem={this._renderTLFEntry} indexAsKey={true} />
        </Kb.Box2>
      </React.Fragment>
    )
  }
}

const ActionButtons = ({onCancel, onSubmit}) => (
  <Kb.Box2
    direction={Styles.isMobile ? 'vertical' : 'horizontalReverse'}
    fullWidth={Styles.isMobile}
    gap="tiny"
  >
    <Kb.WaitingButton
      fullWidth={Styles.isMobile}
      type="Danger"
      label="Yes, delete it"
      waitingKey={Constants.waitingKey}
      onClick={onSubmit}
    />
    <Kb.Button fullWidth={Styles.isMobile} type="Secondary" onClick={onCancel} label="Cancel" />
  </Kb.Box2>
)

const DeviceRevoke = (props: Props) => {
  const icon: Kb.IconType = {
    backup: Styles.isMobile ? 'icon-paper-key-revoke-64' : 'icon-paper-key-revoke-48',
    desktop: Styles.isMobile ? 'icon-computer-revoke-64' : 'icon-computer-revoke-48',
    mobile: Styles.isMobile ? 'icon-phone-revoke-64' : 'icon-phone-revoke-48',
  }[props.device.type]

  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      gap="small"
      gapEnd={true}
      style={styles.container}
    >
      <Kb.NameWithIcon icon={icon} title={props.device.name} titleStyle={styles.headerName} />
      <Kb.Text type="Header" style={styles.centerText}>
        Are you sure you want to revoke{' '}
        {props.device.currentDevice ? (
          'your current device'
        ) : (
          <Kb.Text type="Header" style={styles.italicName}>
            {props.device.name}
          </Kb.Text>
        )}
        ?
      </Kb.Text>
      <Kb.Box2 direction="vertical" style={styles.endangeredTLFContainer} fullWidth={Styles.isMobile}>
        {!props.waiting && <EndangeredTLFList endangeredTLFs={props.endangeredTLFs} />}
      </Kb.Box2>
      <ActionButtons onCancel={props.onCancel} onSubmit={props.onSubmit} />
      {props.waiting && (
        <Kb.Text type="BodySmallItalic" style={styles.centerText}>
          Calculating any side effects...
        </Kb.Text>
      )}
    </Kb.Box2>
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

export default Kb.HeaderHoc(DeviceRevoke)
