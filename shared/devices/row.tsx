import * as Constants from '../constants/devices'
import * as C from '../constants'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import DeviceIcon from './device-icon'
import type * as Types from '../constants/types/devices'
import {formatTimeRelativeToNow} from '../util/timestamp'

type OwnProps = {
  deviceID: Types.DeviceID
  firstItem: boolean
}

export const NewContext = React.createContext(new Set())

export default (ownProps: OwnProps) => {
  const {deviceID, firstItem} = ownProps
  const device = Constants.useState(s => s.deviceMap.get(deviceID))
  if (!device) return null

  const isNew = React.useContext(NewContext).has(deviceID)
  const {currentDevice, name, revokedAt, lastUsed} = device
  const isRevoked = !!device.revokedByName
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const showExistingDevicePage = React.useCallback(() => {
    navigateAppend({props: {deviceID}, selected: 'devicePage'})
  }, [navigateAppend, deviceID])

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
              <Kb.Meta title="new" style={styles.meta} backgroundColor={Styles.globalColors.orange} />
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
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      icon: {opacity: 0.3},
      meta: {
        alignSelf: 'center',
        marginLeft: Styles.isMobile ? Styles.globalMargins.xxtiny : Styles.globalMargins.xtiny,
      },
      text: {
        color: Styles.globalColors.black_20,
        textDecorationLine: 'line-through',
        textDecorationStyle: 'solid',
      },
    }) as const
)
