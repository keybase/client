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

const resetSignal = 'reset'
type DeviceOrReset = Device | 'reset'

const SelectOtherDevice = (props: Props) => {
  const {passwordRecovery, devices, onBack, onSelect, onResetAccount} = props
  const items: DeviceOrReset[] = React.useMemo(() => [...devices, resetSignal], [devices])

  const renderItem = (index: number, item: DeviceOrReset) => {
    if (item === resetSignal) {
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} key="reset">
          <Kb.Text type="BodySmall" style={styles.or}>
            or
          </Kb.Text>
          <Kb.ListItem2
            type="Small"
            firstItem={true}
            key="reset"
            onClick={onResetAccount}
            icon={<Kb.Icon type="icon-skull-32" />}
            body={
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Text type="BodySemibold">I lost all my devices/paper keys</Kb.Text>
                <Kb.Text type="BodySmall">Reset your account</Kb.Text>
              </Kb.Box2>
            }
          />
        </Kb.Box2>
      )
    }

    const descriptions = {
      backup: 'Paper key',
      desktop: 'Computer',
      mobile: 'Phone',
    }

    return (
      <Kb.ListItem2
        type="Small"
        firstItem={index === 0}
        key={item.name}
        onClick={() => onSelect(item.name)}
        icon={<DeviceIcon device={item} size={32} />}
        body={
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySemibold">{item.name}</Kb.Text>
            <Kb.Text type="BodySmall">{descriptions[item.type]}</Kb.Text>
          </Kb.Box2>
        }
      />
    )
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
        <Kb.List
          style={styles.list}
          items={items}
          renderItem={renderItem}
          keyProperty="name"
          ListHeaderComponent={
            <Kb.Box2 direction="vertical" style={styles.headerText}>
              {!passwordRecovery && (
                <Kb.Text center={true} type="Body">
                  For security reasons, you need to authorize this {Kb.Styles.isMobile ? 'phone' : 'computer'}{' '}
                  with another device or a paper key.
                </Kb.Text>
              )}
              <Kb.Text center={true} type="Body">
                Which do you have handy?
              </Kb.Text>
            </Kb.Box2>
          }
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
