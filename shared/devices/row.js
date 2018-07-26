// @flow
import * as Types from '../constants/types/devices'
import * as React from 'react'
import * as Common from '../common-adapters'
import * as Constants from '../constants/devices'
import * as Styles from '../styles'
import {connect, compose, type TypedState, setDisplayName} from '../util/container'
import {isMobile} from '../constants/platform'
import {navigateAppend} from '../actions/route-tree'

const DeviceRow = ({isCurrentDevice, name, isRevoked, type, showExistingDevicePage, firstItem}) => {
  let icon
  switch (type) {
    case 'backup':
      icon = isMobile ? 'icon-paper-key-48' : 'icon-paper-key-32'
      break
    case 'desktop':
      icon = isCurrentDevice
        ? isMobile
          ? 'icon-computer-success-48'
          : 'icon-computer-success-32'
        : isMobile
          ? 'icon-computer-48'
          : 'icon-computer-32'
      break
    case 'mobile':
      icon = isCurrentDevice
        ? isMobile
          ? 'icon-phone-success-48'
          : 'icon-phone-success-32'
        : isMobile
          ? 'icon-phone-48'
          : 'icon-phone-32'
      break
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(type);
      */
      icon = isMobile ? 'icon-paper-key-48' : 'icon-paper-key-32'
  }

  return (
    <Common.ListItem2
      type="Small"
      firstItem={firstItem}
      onClick={showExistingDevicePage}
      icon={<Common.Icon type={icon} style={Common.iconCastPlatformStyles(isRevoked && styles.icon)} />}
      body={
        <Common.Box2 direction="vertical">
          <Common.Text style={isRevoked && styles.text} type="BodySemiboldItalic">
            {name}
          </Common.Text>
          {isCurrentDevice && <Common.Text type="BodySmall">Current device</Common.Text>}
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

type OwnProps = {deviceID: Types.DeviceID, firstItem: boolean}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const device = Constants.getDevice(state, ownProps.deviceID)
  return {
    isCurrentDevice: device.currentDevice,
    isRevoked: !!device.revokedByName,
    name: device.name,
    type: device.type,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _showExistingDevicePage: (deviceID: string) =>
    dispatch(navigateAppend([{props: {deviceID}, selected: 'devicePage'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  firstItem: ownProps.firstItem,
  isCurrentDevice: stateProps.isCurrentDevice,
  isRevoked: stateProps.isRevoked,
  name: stateProps.name,
  showExistingDevicePage: () => dispatchProps._showExistingDevicePage(ownProps.deviceID),
  type: stateProps.type,
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('DeviceRow'))(
  DeviceRow
)
