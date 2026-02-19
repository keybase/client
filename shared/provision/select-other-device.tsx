import * as Kb from '@/common-adapters'
import * as React from 'react'
import DeviceIcon from '../devices/device-icon'
import {SignupScreen} from '../signup/common'
import {type Device} from '@/stores/provision'

type Props = {
  passwordRecovery?: boolean
  devices: ReadonlyArray<Device>
  onBack: () => void
  onSelect: (name: string) => void
  onResetAccount: () => void
}

type Item = {type: 'header'} | {device: Device; type: 'device'} | {type: 'reset'}

const deviceSmallHeight = Kb.Styles.isMobile ? 56 : 48
// "or" text with padding (~36) + ListItem2 Small
const resetHeight = 36 + deviceSmallHeight
// Header text with padding
const headerHeight = Kb.Styles.isMobile ? 80 : 60

const getItemHeight = (item: Item | undefined): number => {
  switch (item?.type) {
    case 'header':
      return headerHeight
    case 'device':
      return deviceSmallHeight
    case 'reset':
      return resetHeight
    default:
      return deviceSmallHeight
  }
}

const SelectOtherDevice = (props: Props) => {
  const {passwordRecovery, devices, onBack, onSelect, onResetAccount} = props

  const items: Item[] = React.useMemo(
    () => [
      {type: 'header'},
      ...devices.map(device => ({device, type: 'device'}) as const),
      {type: 'reset'},
    ],
    [devices]
  )

  const itemHeight = React.useMemo(
    () => ({
      getItemLayout: (index: number, item?: Item) => {
        const length = getItemHeight(item)
        let offset = 0
        for (let i = 0; i < index; i++) {
          offset += getItemHeight(items[i])
        }
        return {index, length, offset}
      },
      type: 'variable' as const,
    }),
    [items]
  )

  const renderItem = (index: number, item: Item) => {
    switch (item.type) {
      case 'header':
        return (
          <Kb.Box2 direction="vertical" style={styles.headerText}>
            {!passwordRecovery && (
              <Kb.Text3 center={true} type="Body">
                For security reasons, you need to authorize this{' '}
                {Kb.Styles.isMobile ? 'phone' : 'computer'} with another device or a paper key.
              </Kb.Text3>
            )}
            <Kb.Text3 center={true} type="Body">
              Which do you have handy?
            </Kb.Text3>
          </Kb.Box2>
        )
      case 'reset':
        return (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text3 type="BodySmall" style={styles.or}>
              or
            </Kb.Text3>
            <Kb.ListItem2
              type="Small"
              firstItem={true}
              onClick={onResetAccount}
              icon={<Kb.Icon type="icon-skull-32" />}
              body={
                <Kb.Box2 direction="vertical" fullWidth={true}>
                  <Kb.Text3 type="BodySemibold">I lost all my devices/paper keys</Kb.Text3>
                  <Kb.Text3 type="BodySmall">Reset your account</Kb.Text3>
                </Kb.Box2>
              }
            />
          </Kb.Box2>
        )
      case 'device': {
        const descriptions = {
          backup: 'Paper key',
          desktop: 'Computer',
          mobile: 'Phone',
        }
        return (
          <Kb.ListItem2
            type="Small"
            firstItem={index === 1}
            onClick={() => onSelect(item.device.name)}
            icon={<DeviceIcon device={item.device} size={32} />}
            body={
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Text3 type="BodySemibold">{item.device.name}</Kb.Text3>
                <Kb.Text3 type="BodySmall">{descriptions[item.device.type]}</Kb.Text3>
              </Kb.Box2>
            }
          />
        )
      }
    }
  }

  return (
    <SignupScreen
      noBackground={true}
      onBack={onBack}
      title={
        passwordRecovery ? 'Recover password' : `Authorize this ${Kb.Styles.isMobile ? 'device' : 'computer'}`
      }
      contentContainerStyle={Kb.Styles.padding(0)}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.contentBox} gap="medium">
        <Kb.List2
          style={styles.list}
          items={items}
          renderItem={renderItem}
          indexAsKey={true}
          itemHeight={itemHeight}
        />
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  contentBox: Kb.Styles.platformStyles({
    common: {alignSelf: 'center', flexGrow: 1},
    isElectron: {
      maxWidth: 460,
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    },
  }),
  headerText: Kb.Styles.platformStyles({
    common: {
      paddingBottom: Kb.Styles.globalMargins.small,
      paddingTop: Kb.Styles.globalMargins.small,
    },
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
      paddingTop: Kb.Styles.globalMargins.small,
    },
  }),
  list: {
    flexGrow: 1,
  },
  or: {
    backgroundColor: Kb.Styles.globalColors.blueGrey,
    color: Kb.Styles.globalColors.black_50,
    ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall),
  },
}))

export default SelectOtherDevice
