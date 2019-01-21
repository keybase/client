// @flow
import * as React from 'react'
import * as Flow from '../../util/flow'
import * as Types from '../../constants/types/provision'
import {ListItem2, BackButton, Box2, List, Text, Icon} from '../../common-adapters'
import {globalMargins, styleSheetCreate, platformStyles, isMobile} from '../../styles'

type Props = {|
  devices: Array<Types.Device>,
  onSelect: (name: string) => void,
  onResetAccount: () => void,
  onBack: () => void,
|}

class SelectOtherDevice extends React.Component<Props> {
  _renderItem = (index, item) => {
    if (item.name === 'troubleshooting') {
      return <Troubleshooting key="trouble" onResetAccount={this.props.onResetAccount} />
    }

    const {name, type} = item
    let iconType
    switch (type) {
      case 'mobile':
        iconType = 'icon-phone-32'
        break
      case 'desktop':
        iconType = 'icon-computer-32'
        break
      case 'backup':
        iconType = 'icon-paper-key-32'
        break
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(type)
        iconType = 'icon-paper-key-32'
    }

    const isBackup = type === 'backup'

    return (
      <ListItem2
        type="Small"
        firstItem={index === 0}
        key={name}
        onClick={() => this.props.onSelect(name)}
        icon={<Icon type={iconType} />}
        body={
          <Box2 direction="vertical" fullWidth={true}>
            <Text type="BodySemibold">
              {name}
              {isBackup ? '...' : ''}
            </Text>
            {isBackup && <Text type="BodySmall">Paper key</Text>}
          </Box2>
        }
      />
    )
  }

  render() {
    const items = [...this.props.devices, {name: 'troubleshooting'}]
    return (
      <Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        gap={isMobile ? undefined : 'medium'}
        gapEnd={true}
      >
        <BackButton onClick={this.props.onBack} style={styles.backButton} />
        <Box2 direction="vertical" fullWidth={true} style={styles.contentBox} gap={'medium'}>
          <Text center={true} type={isMobile ? 'BodyBig' : 'Header'}>
            For security reasons, you need to authorize with an existing device. Which of your existing
            devices would you like to use?
          </Text>
          <List
            style={styles.list}
            items={items}
            renderItem={this._renderItem}
            keyProperty="name"
            fixedHeight={isMobile ? 48 : 40}
          />
        </Box2>
      </Box2>
    )
  }
}

const Troubleshooting = ({onResetAccount}) => (
  <Box2 direction="vertical" gap="small" style={styles.troubleShooting}>
    <Box2 direction="horizontal" fullWidth={true} gap="tiny">
      <Icon type="iconfont-wrenches" />
      <Text type="BodySmallSemibold">Troubleshooting</Text>
    </Box2>
    <Text type="BodySemibold">
      If you have lost all of your devices, or if you uninstalled Keybase from all of them, you can{' '}
      <Text type="BodySemiboldLink" onClick={onResetAccount}>
        reset your account.
      </Text>
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  backButton: platformStyles({
    isElectron: {
      marginLeft: globalMargins.medium,
      marginTop: globalMargins.medium,
    },
    isMobile: {
      marginLeft: 0,
      marginTop: 0,
    },
  }),
  contentBox: platformStyles({
    common: {alignSelf: 'center', flexGrow: 1, padding: globalMargins.small},
    isElectron: {
      maxWidth: 460,
    },
  }),
  list: {
    flexGrow: 1,
  },
  troubleShooting: {
    paddingTop: globalMargins.small,
  },
})

export default SelectOtherDevice
