import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import DeviceIcon from './device-icon'
import type * as T from '@/constants/types'
import {formatTimeRelativeToNow} from '@/util/timestamp'

type OwnProps = {
  device: T.Devices.Device
  firstItem: boolean
}

export const NewContext = React.createContext<ReadonlySet<string>>(new Set())

const Container = React.memo(function Container(ownProps: OwnProps) {
  const {device, firstItem} = ownProps
  const {deviceID, currentDevice, name, revokedAt, lastUsed} = device
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const showExistingDevicePage = React.useCallback(() => {
    navigateAppend({props: {deviceID}, selected: 'devicePage'})
  }, [navigateAppend, deviceID])

  const isNew = React.useContext(NewContext).has(deviceID)
  const isRevoked = !!device.revokedByName

  return (
    <Kb.ListItem2
      type="Small"
      firstItem={firstItem}
      onClick={showExistingDevicePage}
      icon={
        <DeviceIcon
          current={currentDevice}
          device={device}
          size={32}
          style={isRevoked ? styles.icon : null}
        />
      }
      body={
        <Kb.Box2 direction="vertical" fullWidth={true} style={{justifyContent: 'center'}}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.Text lineClamp={1} style={isRevoked ? styles.text : undefined} type="BodySemibold">
              {name} {currentDevice && <Kb.Text type="BodySmall">(Current device)</Kb.Text>}
            </Kb.Text>
            {isNew && !currentDevice && (
              <Kb.Meta title="new" style={styles.meta} backgroundColor={Kb.Styles.globalColors.orange} />
            )}
          </Kb.Box2>
          <Kb.Text type="BodySmall">
            {isRevoked
              ? `Revoked ${revokedAt ? formatTimeRelativeToNow(revokedAt) : 'device'}`
              : `Last used ${formatTimeRelativeToNow(lastUsed)}`}
          </Kb.Text>
        </Kb.Box2>
      }
    />
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      icon: {opacity: 0.3},
      meta: {
        alignSelf: 'center',
        marginLeft: Kb.Styles.isMobile ? Kb.Styles.globalMargins.xxtiny : Kb.Styles.globalMargins.xtiny,
      },
      text: {
        color: Kb.Styles.globalColors.black_20,
        textDecorationLine: 'line-through',
        textDecorationStyle: 'solid',
      },
    }) as const
)

export default Container
