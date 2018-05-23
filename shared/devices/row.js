// @flow
import * as Types from '../constants/types/devices'
import {type TypedState} from '../util/container'
import {isMobile} from '../constants/platform'
import {navigateAppend} from '../actions/route-tree'
import type {IconType} from '../common-adapters'
import {Icon, Box, Text, ClickableBox} from '../common-adapters'
import {globalStyles, globalColors, platformStyles} from '../styles'

// TEMP move to util container
import * as React from 'react'
import {connect} from 'react-redux'
import {setDisplayName} from 'recompose'

type OwnProps = {
  deviceID: Types.DeviceID,
}

const mapStateToProps = (state: TypedState, {deviceID}: OwnProps) => {
  const device = state.devices.idToDetail.get(deviceID)
  if (!device) {
    return {
      icon: isMobile ? 'icon-paper-key-48' : 'icon-paper-key-32',
      isCurrentDevice: false,
      isRevoked: false,
      name: '',
    }
  }

  const icon: IconType = {
    backup: isMobile ? 'icon-paper-key-48' : 'icon-paper-key-32',
    desktop: isMobile ? 'icon-computer-48' : 'icon-computer-32',
    mobile: isMobile ? 'icon-phone-48' : 'icon-phone-32',
  }[device.type]

  return {
    icon,
    isCurrentDevice: device.currentDevice,
    isRevoked: !!device.revokedByName,
    name: device.name,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _showExistingDevicePage: (deviceID: string) =>
    dispatch(navigateAppend([{props: {deviceID}, selected: 'devicePage'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  ...stateProps,
  ...dispatchProps,
  showExistingDevicePage: () => dispatchProps._showExistingDevicePage(ownProps.deviceID),
})

// TODO move to util/container when done
//
type MapStateToProps<S: Object, SP: Object, RSP: Object> = (state: S, props: SP) => RSP

type MapDispatchToProps<A, OP: Object, RDP: Object> = (dispatch: Dispatch<A>, ownProps: OP) => RDP

type MergeProps<SP: Object, DP: Object, MP: Object, RMP: Object> = (
  stateProps: SP,
  dispatchProps: DP,
  ownProps: MP
) => RMP

function namedConnect<
  Props,
  Com: React.ComponentType<Props>,
  A,
  S: Object,
  DP: Object,
  SP: Object,
  RSP: Object,
  RDP: Object,
  MP: Object,
  RMP: Object,
  CP: $Diff<React.ElementConfig<Com>, RMP>
>(
  name: string,
  mapStateToProps: MapStateToProps<S, SP, RSP>,
  mapDispatchToProps: MapDispatchToProps<A, DP, RDP>,
  mergeProps: MergeProps<RSP, RDP, MP, RMP>
): (component: Com) => React.ComponentType<CP & SP & DP & MP> {
  const connector: (component: Com) => React.ComponentType<CP & SP & DP & MP> = connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
  return connector(setDisplayName(name))
}

const Row = ({isCurrentDevice, name, isRevoked, icon, showExistingDevicePage}) => (
  <ClickableBox onClick={showExistingDevicePage} style={{...stylesCommonRow, alignItems: 'center'}}>
    <Box key={name} style={{...globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
      <Icon type={icon} style={isRevoked ? {marginRight: 16, opacity: 0.2} : {marginRight: 16}} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'flex-start'}}>
        <Text style={textStyle(isRevoked)} type="BodySemiboldItalic">
          {name}
        </Text>
        {isCurrentDevice && <Text type="BodySmall">Current device</Text>}
      </Box>
    </Box>
  </ClickableBox>
)

const textStyle = isRevoked =>
  isRevoked
    ? platformStyles({
        common: {
          color: globalColors.black_40,
          flex: 0,
          textDecorationLine: 'line-through',
          textDecorationStyle: 'solid',
        },
        isElectron: {
          fontStyle: 'italic',
        },
      })
    : {
        flex: 0,
      }

const stylesCommonCore = {
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  justifyContent: 'center',
}

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  ...stylesCommonCore,
  minHeight: isMobile ? 64 : 48,
  padding: 8,
}
export default namedConnect('DeviceRow', mapStateToProps, mapDispatchToProps, mergeProps)(Row)
