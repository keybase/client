import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/devices'
import DeviceIcon from '../device-icon'

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
          style={Kb.iconCastPlatformStyles(props.isRevoked ? styles.icon : null)}
        />
      }
      body={
        <Kb.Box2 direction="vertical" fullWidth={true} style={{justifyContent: 'center'}}>
          <Kb.Text style={props.isRevoked ? styles.text : undefined} type="BodySemibold">
            {props.name}
          </Kb.Text>
          {props.isCurrentDevice && <Kb.Text type="BodySmall">Current device</Kb.Text>}
          {props.isNew && !props.isCurrentDevice && (
            <Kb.Meta title="new" style={styles.meta} backgroundColor={Styles.globalColors.orange} />
          )}
        </Kb.Box2>
      }
    />
  )
}
const styles = Styles.styleSheetCreate(
  () =>
    ({
      icon: {opacity: 0.3},
      meta: {alignSelf: 'flex-start'},
      text: {
        color: Styles.globalColors.black_20,
        flex: 0,
        textDecorationLine: 'line-through' as const,
        textDecorationStyle: 'solid' as const,
      },
    } as const)
)

export default DeviceRow
