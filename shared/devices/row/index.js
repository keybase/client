// @flow
import * as React from 'react'
import * as Common from '../../common-adapters'
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
      icon = Styles.isMobile ? 'icon-paper-key-48' : 'icon-paper-key-32'
      break
    case 'desktop':
      icon = props.isCurrentDevice
        ? Styles.isMobile
          ? 'icon-computer-success-48'
          : 'icon-computer-success-32'
        : Styles.isMobile
          ? 'icon-computer-48'
          : 'icon-computer-32'
      break
    case 'mobile':
      icon = props.isCurrentDevice
        ? Styles.isMobile
          ? 'icon-phone-success-48'
          : 'icon-phone-success-32'
        : Styles.isMobile
          ? 'icon-phone-48'
          : 'icon-phone-32'
      break
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(props.type);
      */
      icon = Styles.isMobile ? 'icon-paper-key-48' : 'icon-paper-key-32'
  }

  return (
    <Common.ListItem2
      type="Small"
      firstItem={props.firstItem}
      onClick={props.showExistingDevicePage}
      icon={
        <Common.Icon
          type={icon}
          style={Common.iconCastPlatformStyles(props.isRevoked ? styles.icon : null)}
        />
      }
      body={
        <Common.Box2 direction="vertical">
          <Common.Text style={props.isRevoked ? styles.text : null} type="BodySemiboldItalic">
            {props.name}
          </Common.Text>
          {props.isCurrentDevice && <Common.Text type="BodySmall">Current device</Common.Text>}
        </Common.Box2>
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
    isElectron: {
      fontStyle: 'italic',
    },
  }),
})

export default DeviceRow
