// @flow
import Container from '../../forms/container.desktop'
import * as React from 'react'
import {Text, Icon} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

import type {DeviceType} from '../../../constants/types/more'
import type {IconType} from '../../../common-adapters/icon'
import type {Props} from '.'

const Row = ({deviceID, name, type, onSelect}) => {
  const iconType: IconType = ({
    mobile: 'icon-phone-32',
    desktop: 'icon-computer-32',
    backup: 'icon-paper-key-32',
  }: {[key: DeviceType]: IconType})[type]

  const onClick = e => {
    onSelect(deviceID)
    e && e.preventDefault()
  }

  const realCSS = `
  .deviceRow { border-bottom: 1px solid ${globalColors.black_05} }
  .deviceRow:hover { background: ${globalColors.blue4}; border-bottom: 1px solid ${globalColors.blue4} }
  `

  return (
    <div>
      <style>{realCSS}</style>
      <div style={stylesRow} className="deviceRow" onClick={onClick}>
        <div style={stylesIconName}>
          <div style={stylesIconContainer}>
            <Icon style={stylesIcon} type={iconType} />
          </div>
          <Text type="BodySemiboldItalic" onClick={onClick}>{name}</Text>
        </div>
      </div>
    </div>
  )
}

const SelectOtherDevice = ({onBack, devices, onWont, onSelect, canSelectNoDevice}: Props) => (
  <Container style={stylesContainer} onBack={onBack}>
    <Text type="Header" style={stylesHeader}>Which device would you like to connect with?</Text>
    <div style={stylesDevicesContainer}>
      {devices.map(d => <Row onSelect={onSelect} {...d} key={d.deviceID} />)}
    </div>
    {canSelectNoDevice &&
      <Text style={stylesWont} type="BodySmallSecondaryLink" onClick={onWont}>
        Log in with your passphrase
      </Text>}
  </Container>
)

const stylesContainer = {}
const stylesHeader = {
  alignSelf: 'center',
  marginBottom: globalMargins.large,
  marginTop: globalMargins.large,
}
const stylesDevicesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  overflow: 'auto',
  width: 460,
  alignSelf: 'center',
}
const stylesRow = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.clickable,
  borderRadius: 4,
  justifyContent: 'center',
  minHeight: 32,
  padding: globalMargins.tiny,
}
const stylesIconName = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}
const stylesIconContainer = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  alignItems: 'center',
}
const stylesIcon = {
  color: globalColors.black,
  marginLeft: 32,
  marginRight: 22,
  maxHeight: 60,
}
const stylesWont = {
  marginTop: globalMargins.medium,
  alignSelf: 'center',
}

export default SelectOtherDevice
