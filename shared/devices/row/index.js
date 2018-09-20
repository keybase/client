// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {|
  isCurrentDevice: boolean,
  name: string,
  isRevoked: boolean,
  type: 'desktop' | 'backup' | 'mobile',
  showExistingDevicePage: () => void,
  firstItem: boolean,
|}

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
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(props.type)
      */
      icon = 'icon-paper-key-48'
  }

  return (
    <Kb.ListItem2
      type="Small"
      firstItem={props.firstItem}
      onClick={props.showExistingDevicePage}
      icon={<Kb.Icon type={icon} style={Kb.iconCastPlatformStyles(props.isRevoked ? styles.icon : null)} />}
      body={
        <Kb.Box2 direction="vertical" style={{justifyContent: 'center', minHeight: 48}}>
          <Kb.Text style={props.isRevoked ? styles.text : null} type="BodySemibold">
            {props.name}
          </Kb.Text>
          {props.isCurrentDevice && <Kb.Text type="BodySmall">Current device</Kb.Text>}
        </Kb.Box2>
      }
    />
  )
}
const styles = Styles.styleSheetCreate({
  icon: {opacity: 0.2},
  text: Styles.platformStyles({
    common: {
      color: Styles.globalColors.black_40,
      flex: 0,
      textDecorationLine: 'line-through',
      textDecorationStyle: 'solid',
    },
    isElectron: {},
  }),
})

export default DeviceRow
