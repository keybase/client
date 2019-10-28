import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as ProvisionTypes from '../../../constants/types/provision'
import {globalMargins, styleSheetCreate, platformStyles, isMobile} from '../../../styles'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import DeviceIcon from '../../../devices/device-icon'

const resetSignal = 'reset'
type DeviceOrReset = ProvisionTypes.Device | 'reset'
type ItemProps = {
  index: number
  item: DeviceOrReset
  onSelect: (name) => void
  onResetAccount: () => void
}

const RecoverMenuItem = (props: ItemProps) => {
  if (props.item === resetSignal) {
    return (
      <Kb.ListItem2
        type="Small"
        firstItem={props.index === 0}
        key={name}
        onClick={props.onResetAccount}
        icon={<Kb.Icon sizeType="Big" type="iconfont-skull" />}
        body={
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySemibold">I don't have any of these</Kb.Text>
            <Kb.Text type="BodySmall">Reset your account</Kb.Text>
          </Kb.Box2>
        }
      />
    )
  }
  return (
    <Kb.ListItem2
      type="Small"
      firstItem={props.index === 0}
      key={name}
      onClick={() => props.onSelect(name)}
      icon={<DeviceIcon device={props.item} size={32} />}
      body={
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySemibold">{props.item.name}</Kb.Text>
          {props.item.type === 'backup' && <Kb.Text type="BodySmall">Paper key</Kb.Text>}
        </Kb.Box2>
      }
    />
  )
}

export type Props = {
  devices: Array<ProvisionTypes.Device>
  onBack: () => void
  onSelect: (name: string) => void
  onResetAccount: () => void
}

const DeviceSelector = (props: Props) => {
  const items: DeviceOrReset[] = [...props.devices, resetSignal]
  return (
    <SignupScreen onBack={props.onBack} noBackground={true} title="Recover password">
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} fullHeight={true}>
        <Kb.Text type="Body">Which do you have handy?</Kb.Text>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          fullHeight={true}
          style={styles.contentBox}
          gap="medium"
        >
          <Kb.List
            style={styles.list}
            items={items}
            renderItem={(index, item) => (
              <RecoverMenuItem
                onResetAccount={props.onResetAccount}
                onSelect={props.onSelect}
                index={index}
                item={item}
              />
            )}
            keyProperty="name"
            fixedHeight={isMobile ? 48 : 40}
          />
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = styleSheetCreate(() => ({
  contentBox: platformStyles({
    common: {alignSelf: 'center', flexGrow: 1},
    isElectron: {
      maxWidth: 460,
      padding: globalMargins.small,
    },
  }),
  list: {
    flexGrow: 1,
  },
}))

DeviceSelector.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

export default DeviceSelector
