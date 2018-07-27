// @flow
import * as React from 'react'
import * as Constants from '../../constants/devices'
import * as Types from '../../constants/types/devices'
import * as Common from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  currentDevice: boolean,
  deviceID: string,
  endangeredTLFs: Array<string>,
  type: Types.DeviceType,
  name: string,
  onCancel: () => void,
  onSubmit: () => void,
  waiting: boolean,
}

const Header = ({name, type}) => {
  const headerIcon: Common.IconType = {
    backup: Styles.isMobile ? 'icon-paper-key-revoke-64' : 'icon-paper-key-revoke-48',
    desktop: Styles.isMobile ? 'icon-computer-revoke-64' : 'icon-computer-revoke-48',
    mobile: Styles.isMobile ? 'icon-phone-revoke-64' : 'icon-phone-revoke-48',
  }[type]
  return (
    <Common.Box style={styles.headerContainer}>
      <Common.Icon type={headerIcon} />
      <Common.Text type="BodySemibold" style={styles.headerDeviceName}>
        {name}
      </Common.Text>
    </Common.Box>
  )
}

const BodyText = ({name, currentDevice}) => (
  <Common.Box style={styles.bodyTextContainer}>
    <Common.Text type="BodySemibold" style={styles.bodyText}>
      Are you sure you want to revoke{' '}
      {currentDevice ? 'your current device' : <Common.Text type="BodySemiboldItalic">{name}</Common.Text>}
      ?
    </Common.Text>
  </Common.Box>
)

class EndangeredTLFList extends React.Component<
  {endangeredTLFs: Array<string>, waiting: boolean, style: Styles.StylesCrossPlatform},
  {}
> {
  _renderTLFEntry = (index: number, tlf: string) => (
    <Common.Box key={index} style={styles.tlfEntry}>
      <Common.Text type="BodySemibold" style={{marginRight: Styles.globalMargins.tiny}}>
        •
      </Common.Text>
      <Common.Text type="BodySemibold" selectable={true} style={{flex: 1}}>
        {tlf}
      </Common.Text>
    </Common.Box>
  )
  render() {
    if (this.props.waiting) {
      return <Common.ProgressIndicator />
    } else if (this.props.endangeredTLFs.length > 0) {
      return (
        <React.Fragment>
          <Common.Text type="Body" style={styles.bodyText}>
            You may lose access to these folders forever:
          </Common.Text>
          <Common.Box style={styles.listContainer}>
            <Common.List
              items={this.props.endangeredTLFs}
              renderItem={this._renderTLFEntry}
              style={styles.list}
            />
          </Common.Box>
        </React.Fragment>
      )
    }
    return null
  }
}

const ActionButtons = ({onCancel, onSubmit}) => (
  <Common.Box2
    direction={Styles.isMobile ? 'vertical' : 'horizontalReverse'}
    style={styles.actionButtonsContainer}
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

const DeviceRevoke = (props: Props) => (
  <Common.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
    <Common.Box style={styles.deviceRevokeContainer}>
      <Header name={props.name} type={props.type} />
      <BodyText name={props.name} currentDevice={props.currentDevice} />
      <EndangeredTLFList
        endangeredTLFs={props.endangeredTLFs}
        waiting={props.waiting}
        style={styles.endangeredTLFList}
      />
      <ActionButtons onCancel={props.onCancel} onSubmit={props.onSubmit} />
    </Common.Box>
  </Common.Box2>
)

const styles = Styles.styleSheetCreate({
  deviceRevokeContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    marginBottom: Styles.globalMargins.small,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
  },
  headerContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    height: 112,
    justifyContent: 'center',
    marginBottom: Styles.globalMargins.small,
  },
  headerDeviceName: {
    color: Styles.globalColors.red,
    fontStyle: 'italic',
    marginTop: 4,
    textDecorationLine: 'line-through',
  },
  bodyTextContainer: {marginBottom: Styles.globalMargins.tiny},
  bodyText: {textAlign: 'center'},
  listContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignContent: 'center',
      borderColor: Styles.globalColors.black_05,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      marginBottom: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.small,
    },
    isElectron: {height: 162, width: 440},
    isMobile: {flex: 1, width: '100%'},
  }),
  endangeredTLFList: {flex: 1},
  list: {margin: Styles.globalMargins.small},
  tlfEntry: Styles.platformStyles({
    common: {
      flexDirection: 'row',
      marginBottom: Styles.globalMargins.xtiny,
    },
    isElectron: {textAlign: 'left'},
  }),
  actionButtonsContainer: Styles.platformStyles({
    isElectron: {marginTop: Styles.globalMargins.medium},
    isMobile: {
      marginTop: Styles.globalMargins.small,
      width: '100%',
    },
  }),
})

export default Common.HeaderHoc(DeviceRevoke)
