import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Flow from '../../util/flow'
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

const DeviceRow = (props: Props) => {
  let icon
  switch (props.type) {
    case 'backup':
      icon = 'icon-paper-key-32'
      break
    case 'desktop':
      icon = props.isCurrentDevice ? 'icon-computer-success-32' : 'icon-computer-32'
      break
    case 'mobile':
      icon = props.isCurrentDevice ? 'icon-phone-success-32' : 'icon-phone-32'
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.type)
      icon = 'icon-paper-key-48'
  }

  return (
    <Kb.ListItem2
      type="Small"
      firstItem={props.firstItem}
      onClick={props.showExistingDevicePage}
      icon={<Kb.Icon type={icon} style={Kb.iconCastPlatformStyles(props.isRevoked ? styles.icon : null)} />}
      body={
        <Kb.Box2 direction="vertical" fullWidth={true} style={{justifyContent: 'center'}}>
          <Kb.Text style={props.isRevoked ? styles.text : null} type="BodySemibold">
            {props.name}
          </Kb.Text>
          {props.isCurrentDevice && <Kb.Text type="BodySmall">Current device</Kb.Text>}
          {props.isNew && !props.isCurrentDevice && (
            <Kb.Meta title="new" style={_metaStyle} backgroundColor={Styles.globalColors.orange} />
          )}
        </Kb.Box2>
      }
    />
  )
}
const styles = Styles.styleSheetCreate({
  icon: {opacity: 0.2},
  text: {
    color: Styles.globalColors.black_50,
    flex: 0,
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
  },
})

const _metaStyle = {
  alignSelf: 'flex-start',
} as const

export default DeviceRow
