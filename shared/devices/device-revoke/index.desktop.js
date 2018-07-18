// @flow
import * as React from 'react'
import {type DeviceType} from '../../constants/types/devices'
import type {Props} from '.'
import {Confirm, Box, List, Text, Icon, ProgressIndicator, type IconType} from '../../common-adapters'
import {
  globalColors,
  globalMargins,
  globalStyles,
  styleSheetCreate,
  isMobile,
  platformStyles,
} from '../../styles'

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
        <Box>
          <Box>
            <Text type="Body">You may lose access to these folders forever:</Text>
          </Box>
          <Box style={styles.tlfListContainer}>
            <List
              items={this.props.endangeredTLFs}
              renderItem={this._renderTLFEntry}
              style={styles.tlfList}
            />
          </Box>
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
  tlfEntry: platformStyles({
    common: {
      flexDirection: 'row',
      marginBottom: globalMargins.xtiny,
    },
    isElectron: {
      textAlign: 'left',
    },
  }),
  tlfList: {
    margin: globalMargins.small,
    flex: 1,
  },
  tlfListContainer: platformStyles({
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
      height: 176,
      width: '100%',
    },
  }),
})

export default DeviceRevoke
