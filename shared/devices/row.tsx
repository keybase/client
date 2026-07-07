import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import DeviceIcon from './device-icon'
import type * as T from '@/constants/types'
import {formatTimeRelativeToNow} from '@/util/timestamp'
import {useIsNew} from '@/util/use-local-badging'

type OwnProps = {
  canRevoke: boolean
  device: T.Devices.Device
  firstItem: boolean
}

function DeviceRow(ownProps: OwnProps) {
  const {canRevoke, device, firstItem} = ownProps
  const {deviceID} = device
  const navigateAppend = C.Router2.navigateAppend
  const showExistingDevicePage = () => {
    navigateAppend({name: 'devicePage', params: {canRevoke, device}})
  }

  const isNew = useIsNew(deviceID)
  const {currentDevice, name, revokedAt, lastUsed} = device
  const isRevoked = !!device.revokedByName

  return (
    <Kb.ListItem
      type="Small"
      firstItem={firstItem}
      testID={TestIDs.DEVICES_ROW}
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
        <Kb.Box2 direction="vertical" fullWidth={true} justifyContent="center">
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.Text lineClamp={1} style={isRevoked ? styles.text : undefined} type="BodySemibold">
              {name} {currentDevice && <Kb.Text type="BodySmall">(Current device)</Kb.Text>}
            </Kb.Text>
            {isNew && !currentDevice && <Kb.Meta variant="new" style={styles.meta} />}
          </Kb.Box2>
          <Kb.Text type="BodySmall">
            {isRevoked
              ? `Revoked ${revokedAt ? formatTimeRelativeToNow(revokedAt) : 'device'}`
              : lastUsed
                ? `Last used ${formatTimeRelativeToNow(lastUsed)}`
                : 'Last used unknown'}
          </Kb.Text>
        </Kb.Box2>
      }
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      icon: {opacity: 0.3},
      meta: {
        marginLeft: isMobile ? Kb.Styles.globalMargins.xxtiny : Kb.Styles.globalMargins.xtiny,
      },
      text: {
        color: Kb.Styles.globalColors.black_20,
        textDecorationLine: 'line-through',
        textDecorationStyle: 'solid',
      },
    }) as const
)

export default DeviceRow
