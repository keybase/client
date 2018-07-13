// @flow
import * as React from 'react'
import {type DeviceType} from '../../constants/types/devices'
import {Confirm, Box, List, Text, Icon, ProgressIndicator, type IconType} from '../../common-adapters'
import {
  globalColors,
  globalMargins,
  globalStyles,
  styleSheetCreate,
  isMobile,
  platformStyles,
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
  const icon: IconType = {
    backup: isMobile ? 'icon-paper-key-revoke-64' : 'icon-paper-key-revoke-48',
    desktop: isMobile ? 'icon-computer-revoke-64' : 'icon-computer-revoke-48',
    mobile: isMobile ? 'icon-phone-revoke-64' : 'icon-phone-revoke-48',
  }[props.type]
  return (
    <Box style={styles.header}>
      <Icon type={icon} />
      <Text type="BodySemibold" style={styles.headerDeviceName}>
        {props.name}
      </Text>
    </Box>
  )
}

class EndangeredTLFList extends React.Component<{endangeredTLFs: Array<string>, waiting: boolean}, {}> {
  _renderTLFEntry = (index: number, tlf: string) => (
    <Box key={index} style={styles.tlfEntry}>
      <Text type="BodySemibold" style={{marginRight: globalMargins.tiny}}>
        •
      </Text>
      <Text type="BodySemibold" selectable={true}>
        {tlf}
      </Text>
    </Box>
  )
  render() {
    if (this.props.waiting) {
      return <ProgressIndicator />
    } else if (this.props.endangeredTLFs.length > 0) {
      return (
        <Box>
          <Box>
            <Text type="Body">You may lose access to these folders forever:</Text>
          </Box>
          <List
            items={this.props.endangeredTLFs}
            renderItem={this._renderTLFEntry}
            style={styles.tlfListContainer}
          />
        </Box>
      )
    }
    return null
  }
}

const BodyText = (props: {name: string, currentDevice: boolean}) => (
  <Box style={styles.bodyTextContainer}>
    <Text type="BodySemibold" style={styles.bodyText}>
      Are you sure you want to revoke{' '}
      {props.currentDevice ? 'your current device' : <Text type="BodySemiboldItalic">{props.name}</Text>}
      ?
    </Text>
  </Box>
)

const DeviceRevoke = (props: Props) => (
  <Confirm
    body={
      <Box>
        <BodyText name={props.name} currentDevice={props.currentDevice} />
        <EndangeredTLFList endangeredTLFs={props.endangeredTLFs} waiting={props.waiting} />
      </Box>
    }
    danger={true}
    header={<Header name={props.name} type={props.type} />}
    onCancel={props.onCancel}
    onSubmit={props.waiting ? null : props.onSubmit}
    disabled={!!props.waiting}
    submitLabel="Yes, delete it"
    theme="public"
  />
)

const styles = styleSheetCreate({
  bodyText: {
    textAlign: 'center',
  },
  bodyTextContainer: {
    marginBottom: globalMargins.tiny,
  },
  header: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
  },
  headerDeviceName: {
    color: globalColors.red,
    fontStyle: 'italic',
    marginTop: 4,
    textDecorationLine: 'line-through',
  },
  tlfListContainer: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
      alignItems: 'flex-start',
      alignSelf: 'center',
      borderColor: globalColors.black_05,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      marginBottom: globalMargins.small,
      marginTop: globalMargins.small,
      padding: globalMargins.small,
    },
    isElectron: {
      minHeight: 162,
      width: 440,
    },
    isMobile: {
      width: '100%',
    },
  }),

  tlfEntry: {
    flexDirection: 'row',
    marginBottom: globalMargins.xtiny,
    textAlign: 'left',
  },
})

export default DeviceRevoke
