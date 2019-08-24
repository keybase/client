import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

export type Props = {
  firstItem: boolean
  isCurrentDevice: boolean
  isNew: boolean
  isRevoked: boolean
  name: string
  showExistingDevicePage: () => void
  type: 'desktop' | 'backup' | 'mobile'
}

const typeToIcon = (type: Props['type'], isCurrentDevice: boolean) => {
  switch (type) {
    case 'backup':
      return 'icon-paper-key-32'
    case 'desktop':
      return isCurrentDevice ? 'icon-computer-success-32' : 'icon-computer-32'
    case 'mobile':
      return isCurrentDevice ? 'icon-phone-success-32' : 'icon-phone-32'
  }
}

const DeviceRow = (props: Props) => {
  return (
    <Kb.ListItem2
      type="Small"
      firstItem={props.firstItem}
      onClick={props.showExistingDevicePage}
      icon={
        <Kb.Icon
          type={typeToIcon(props.type, props.isCurrentDevice)}
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
const styles = Styles.styleSheetCreate({
  icon: {opacity: 0.3},
  meta: {alignSelf: 'flex-start'},
  text: {
    color: Styles.globalColors.black_20,
    flex: 0,
    textDecorationLine: 'line-through' as const,
    textDecorationStyle: 'solid' as const,
  },
})

export default DeviceRow
