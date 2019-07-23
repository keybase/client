import * as React from 'react'
import * as Types from '../../constants/types/provision'
import * as Kb from '../../common-adapters'
import {globalMargins, styleSheetCreate, platformStyles, isMobile} from '../../styles'

type Props = {
  devices: Array<Types.Device>
  onSelect: (name: string) => void
  onResetAccount: () => void
  onBack?: () => void
}

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
        iconType = 'icon-paper-key-32'
    }

    const isBackup = type === 'backup'

    return (
      <Kb.ListItem2
        type="Small"
        firstItem={index === 0}
        key={name}
        onClick={() => this.props.onSelect(name)}
        icon={<Kb.Icon type={iconType} />}
        body={
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySemibold">
              {name}
              {isBackup ? '...' : ''}
            </Kb.Text>
            {isBackup && <Kb.Text type="BodySmall">Paper key</Kb.Text>}
          </Kb.Box2>
        }
      />
    )
  }

  render() {
    const items = [...this.props.devices, {name: 'troubleshooting'}]
    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        gap={isMobile ? undefined : 'medium'}
        gapEnd={true}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentBox} gap={'medium'}>
          <Kb.List
            style={styles.list}
            items={items}
            renderItem={this._renderItem}
            keyProperty="name"
            ListHeaderComponent={
              <Kb.Text center={true} type={isMobile ? 'BodyBig' : 'Header'} style={styles.headerText}>
                For security reasons, you need to authorize with an existing device. Which of your existing
                devices would you like to use?
              </Kb.Text>
            }
            fixedHeight={isMobile ? 48 : 40}
          />
        </Kb.Box2>
        {this.props.onBack && (
          <Kb.Box2 direction="horizontal">
            <Kb.Button label="Back to my existing account" onClick={this.props.onBack} />
          </Kb.Box2>
        )}
      </Kb.Box2>
    )
  }
}

const Troubleshooting = ({onResetAccount}) => (
  <Kb.Box2 direction="vertical" gap="small" style={styles.troubleShooting}>
    <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
      <Kb.Icon type="iconfont-wrenches" />
      <Kb.Text type="BodySmallSemibold">Troubleshooting</Kb.Text>
    </Kb.Box2>
    <Kb.Text type="BodySemibold">
      If you have lost all of your devices, or if you uninstalled Keybase from all of them, you can{' '}
      <Kb.Text type="BodySemiboldLink" onClick={onResetAccount}>
        reset your account.
      </Kb.Text>
    </Kb.Text>
  </Kb.Box2>
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
    common: {alignSelf: 'center', flexGrow: 1},
    isElectron: {
      maxWidth: 460,
      padding: globalMargins.small,
    },
  }),
  headerText: platformStyles({
    isMobile: {
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
      paddingTop: globalMargins.small,
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
