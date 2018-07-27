// @flow
import * as React from 'react'
import {type DeviceType} from '../../constants/types/devices'
import {
  Box,
  Box2,
  Button,
  HeaderHoc,
  List,
  Text,
  Icon,
  ProgressIndicator,
  type IconType,
} from '../../common-adapters'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  globalStyles,
  styleSheetCreate,
  isMobile,
  platformStyles,
  type StylesCrossPlatform,
} from '../../styles'

export type Props = {
  currentDevice: boolean,
  deviceID: string,
  endangeredTLFs: Array<string>,
  type: DeviceType,
  name: string,
  onCancel: () => void,
  onSubmit: () => void,
  waiting: boolean,
}

const Header = (props: {name: string, type: DeviceType}) => {
  const headerIcon: IconType = {
    backup: isMobile ? 'icon-paper-key-revoke-64' : 'icon-paper-key-revoke-48',
    desktop: isMobile ? 'icon-computer-revoke-64' : 'icon-computer-revoke-48',
    mobile: isMobile ? 'icon-phone-revoke-64' : 'icon-phone-revoke-48',
  }[props.type]
  return (
    <Box style={styles.headerContainer}>
      <Icon type={headerIcon} />
      <Text type="BodySemibold" style={styles.headerDeviceName}>
        {props.name}
      </Text>
    </Box>
  )
}

const BodyText = (props: {name: string, currentDevice: boolean}) => (
  <Box style={styles.bodyTextContainer}>
    <Text type="Header" style={collapseStyles([styles.bodyText, styles.bodyTextHeader])}>
      Are you sure you want to revoke {props.currentDevice ? 'your current device' : props.name}
      ?
    </Text>
    <Text type="Body" style={styles.bodyText}>
      Revoked devices will not be able to access your Keybase account.
    </Text>
  </Box>
)

class EndangeredTLFList extends React.Component<
  {endangeredTLFs: Array<string>, waiting: boolean, style: StylesCrossPlatform},
  {}
> {
  _renderTLFEntry = (index: number, tlf: string) => (
    <Box key={index} style={styles.tlfEntry}>
      <Text type="BodySemibold" style={{marginRight: globalMargins.tiny}}>
        •
      </Text>
      <Text type="BodySemibold" selectable={true} style={{flex: 1}}>
        {tlf}
      </Text>
    </Box>
  )
  render() {
    if (this.props.waiting) {
      return <ProgressIndicator />
    } else if (this.props.endangeredTLFs.length > 0) {
      return (
        <React.Fragment>
          <Text type="Body" style={styles.bodyText}>
            You may lose access to these folders forever:
          </Text>
          <Box style={styles.listContainer}>
            <List items={this.props.endangeredTLFs} renderItem={this._renderTLFEntry} style={styles.list} />
          </Box>
        </React.Fragment>
      )
    }
    return null
  }
}

const ActionButtons = (props: {onCancel: () => void, onSubmit: () => void, waiting: boolean}) => (
  <Box2
    direction={isMobile ? 'vertical' : 'horizontalReverse'}
    style={styles.actionButtonsContainer}
    gap="tiny"
  >
    <Button
      fullWidth={isMobile}
      type="Danger"
      onClick={props.waiting ? null : props.onSubmit}
      label="Yes, revoke it"
      disabled={props.waiting}
    />
    <Button fullWidth={isMobile} type="Secondary" onClick={props.onCancel} label="Cancel" />
  </Box2>
)

const DeviceRevoke = (props: Props) => (
  <Box2 direction="vertical" fullHeight={true} fullWidth={true}>
    <Box style={styles.deviceRevokeContainer}>
      <Header name={props.name} type={props.type} />
      <BodyText name={props.name} currentDevice={props.currentDevice} />
      <EndangeredTLFList
        endangeredTLFs={props.endangeredTLFs}
        waiting={props.waiting}
        style={styles.endangeredTLFList}
      />
      <ActionButtons onCancel={props.onCancel} onSubmit={props.onSubmit} waiting={props.waiting} />
    </Box>
  </Box2>
)

const styles = styleSheetCreate({
  deviceRevokeContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    marginBottom: globalMargins.small,
    marginLeft: globalMargins.small,
    marginRight: globalMargins.small,
  },
  headerContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    height: 112,
    justifyContent: 'center',
    marginBottom: globalMargins.small,
  },
  headerDeviceName: {
    color: globalColors.red,
    fontStyle: 'italic',
    marginTop: 4,
    textDecorationLine: 'line-through',
  },
  bodyTextContainer: {
    ...globalStyles.flexBoxColumn,
    marginBottom: globalMargins.tiny,
  },
  bodyText: {
    textAlign: 'center',
  },
  bodyTextHeader: {
    marginBottom: globalMargins.medium,
  },
  listContainer: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
      alignContent: 'center',
      borderColor: globalColors.black_05,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      marginBottom: globalMargins.small,
      marginTop: globalMargins.small,
    },
    isElectron: {
      height: 162,
      width: 440,
    },
    isMobile: {
      flex: 1,
      width: '100%',
    },
  }),
  endangeredTLFList: {
    flex: 1,
  },
  list: {
    margin: globalMargins.small,
  },
  tlfEntry: platformStyles({
    common: {
      flexDirection: 'row',
      marginBottom: globalMargins.xtiny,
    },
    isElectron: {
      textAlign: 'left',
    },
  }),
  actionButtonsContainer: platformStyles({
    isElectron: {
      marginTop: globalMargins.medium,
    },
    isMobile: {
      marginTop: globalMargins.small,
      width: '100%',
    },
  }),
})

export default HeaderHoc(DeviceRevoke)
