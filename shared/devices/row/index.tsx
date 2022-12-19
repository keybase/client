import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type * as Types from '../../constants/types/devices'
import DeviceIcon from '../device-icon'
import {formatTimeRelativeToNow} from '../../util/timestamp'

export type Props = {
  device: Types.Device
  firstItem: boolean
  isCurrentDevice: boolean
  isNew: boolean
  isRevoked: boolean
  name: string
  showExistingDevicePage: () => void
  type: 'desktop' | 'backup' | 'mobile'
}

const DeviceRow = (props: Props) => {
  return (
    <Kb.ListItem2
      type="Small"
      firstItem={props.firstItem}
      onClick={props.showExistingDevicePage}
      icon={
        <DeviceIcon
          current={props.device.currentDevice}
          device={props.device}
          size={32}
          style={props.isRevoked ? styles.icon : null}
        />
      }
      body={
        <Kb.Box2 direction="vertical" fullWidth={true} style={{justifyContent: 'center'}}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.Text lineClamp={1} style={props.isRevoked ? styles.text : undefined} type="BodySemibold">
              {props.name} {props.isCurrentDevice && <Kb.Text type="BodySmall">(Current device)</Kb.Text>}
            </Kb.Text>
            {props.isNew && !props.isCurrentDevice && (
              <Kb.Meta title="new" style={styles.meta} backgroundColor={Styles.globalColors.orange} />
            )}
          </Kb.Box2>
          <Kb.Text type="BodySmall">
            {props.isRevoked
              ? `Revoked ${
                  props.device.revokedAt ? formatTimeRelativeToNow(props.device.revokedAt) : 'device'
                }`
              : `Last used ${formatTimeRelativeToNow(props.device.lastUsed)}`}
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
      meta: Styles.platformStyles({
        common: {
          alignSelf: 'center',
        },
        isElectron: {
          marginLeft: Styles.globalMargins.xtiny,
        },
        isMobile: {
          marginLeft: Styles.globalMargins.xxtiny,
        },
      }),
      text: {
        color: Styles.globalColors.black_20,
        textDecorationLine: 'line-through' as const,
        textDecorationStyle: 'solid' as const,
      },
    } as const)
)

export default DeviceRow
