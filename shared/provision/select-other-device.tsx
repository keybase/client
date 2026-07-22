import * as Kb from '@/common-adapters'
import DeviceIcon from '../devices/device-icon'
import {SignupScreen} from '../signup/common'
import {type Device} from '@/constants/provision'

type Props = {
  passwordRecovery?: boolean
  devices: ReadonlyArray<Device>
  onBack: () => void
  onSelect: (name: string) => void
  onResetAccount: () => void
  waitingDeviceName?: string
}

type Item = {type: 'header'} | {device: Device; type: 'device'} | {type: 'reset'}

// The header wraps to a device-dependent number of lines, so let the list measure real
// heights; declaring stale fixed sizes makes containers overlap and eat taps on iOS.
const itemHeight = {type: 'trueVariable'} as const

const SelectOtherDevice = (props: Props) => {
  const {passwordRecovery, devices, onBack, onSelect, onResetAccount, waitingDeviceName} = props

  const items: Item[] = [
    {type: 'header'},
    ...devices.map(device => ({device, type: 'device'}) as const),
    {type: 'reset'},
  ]

  const renderItem = (index: number, item: Item) => {
    switch (item.type) {
      case 'header':
        return (
          <Kb.Box2 direction="vertical" style={styles.headerText}>
            {!passwordRecovery && (
              <Kb.Text center={true} type="Body">
                For security reasons, you need to authorize this{' '}
                {isMobile ? 'phone' : 'computer'} with another device or a paper key.
              </Kb.Text>
            )}
            <Kb.Text center={true} type="Body">
              Which do you have handy?
            </Kb.Text>
          </Kb.Box2>
        )
      case 'reset':
        return (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySmall" style={styles.or}>
              or
            </Kb.Text>
            <Kb.ListItem
              type="Small"
              firstItem={true}
              onClick={onResetAccount}
              icon={<Kb.ImageIcon type="icon-skull-32" />}
              body={
                <Kb.Box2 direction="vertical" fullWidth={true}>
                  <Kb.Text type="BodySemibold">I lost all my devices/paper keys</Kb.Text>
                  <Kb.Text type="BodySmall">Reset your account</Kb.Text>
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
          <Kb.ListItem
            type="Small"
            firstItem={index === 1}
            onClick={waitingDeviceName ? undefined : () => onSelect(item.device.name)}
            icon={<DeviceIcon device={item.device} size={32} />}
            body={
              <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center">
                <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne}>
                  <Kb.Text type="BodySemibold">{item.device.name}</Kb.Text>
                  <Kb.Text type="BodySmall">{descriptions[item.device.type]}</Kb.Text>
                </Kb.Box2>
                {item.device.name === waitingDeviceName && <Kb.ProgressIndicator />}
              </Kb.Box2>
            }
          />
        )
      }
    }
  }

  return (
    <SignupScreen
      hideDesktopHeader={!isMobile}
      waitingOverlay={true}
      noBackground={true}
      onBack={onBack}
      title={
        passwordRecovery ? 'Recover password' : `Authorize this ${isMobile ? 'device' : 'computer'}`
      }
      contentContainerStyle={Kb.Styles.padding(0)}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} alignSelf="center" style={styles.contentBox}>
        <Kb.List
          style={styles.list}
          items={items}
          renderItem={renderItem}
          indexAsKey={true}
          itemHeight={itemHeight}
          estimatedItemHeight={56}
        />
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  contentBox: Kb.Styles.platformStyles({
    common: {flexGrow: 1},
    isElectron: {
      maxWidth: 460,
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
    },
  }),
  headerText: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.paddingV(Kb.Styles.globalMargins.small),
    },
    isMobile: {
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
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
