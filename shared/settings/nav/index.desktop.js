// @flow
import React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Badge, ClickableBox, Text} from '../../common-adapters'
import {
  landingTab,
  invitationsTab,
  notificationsTab,
  deleteMeTab,
  devMenuTab,
} from '../../constants/settings'

import type {Props, SettingsItem as SettingsItemType} from './index'

export function SettingsItem({text, selected, onClick, badgeNumber}: SettingsItemType) {
  return (
    <ClickableBox onClick={onClick} style={selected ? selectedStyle : itemStyle}>
      <Text type={'BodySmallSemibold'} style={selected ? selectedTextStyle : itemTextStyle}>
        {text}
      </Text>
      {!!badgeNumber &&
        badgeNumber > 0 &&
        <Badge badgeStyle={badgeStyle} badgeNumber={badgeNumber} />}
    </ClickableBox>
  )
}

function SettingsNav({badgeNumbers, selectedTab, onTabChange}: Props) {
  return (
    <Box style={styleNavBox}>
      <SettingsItem
        text="Your Account"
        selected={selectedTab === landingTab}
        badgeNumber={badgeNumbers[landingTab]}
        onClick={() => onTabChange(landingTab)}
      />
      <SettingsItem
        text="Invitations"
        selected={selectedTab === invitationsTab}
        badgeNumber={badgeNumbers[invitationsTab]}
        onClick={() => onTabChange(invitationsTab)}
      />
      <SettingsItem
        text="Notifications"
        selected={selectedTab === notificationsTab}
        badgeNumber={badgeNumbers[notificationsTab]}
        onClick={() => onTabChange(notificationsTab)}
      />
      <SettingsItem
        text="Delete Me"
        selected={selectedTab === deleteMeTab}
        badgeNumber={badgeNumbers[deleteMeTab]}
        onClick={() => onTabChange(deleteMeTab)}
      />
      {__DEV__ &&
        <SettingsItem
          text="😎 &nbsp; Dev Menu"
          selected={selectedTab === devMenuTab}
          onClick={() => onTabChange(devMenuTab)}
        />}
    </Box>
  )
}
const styleNavBox = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  borderRight: '1px solid ' + globalColors.black_05,
  width: 144,
}
const itemStyle = {
  ...globalStyles.flexBoxRow,
  height: 32,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  alignItems: 'center',
  position: 'relative',
  textTransform: 'uppercase',
}
const selectedStyle = {
  ...itemStyle,
  borderLeft: '3px solid ' + globalColors.blue,
}
const itemTextStyle = {
  color: globalColors.black_60,
}
const selectedTextStyle = {
  color: globalColors.black_75,
}
const badgeStyle = {
  marginRight: 0,
  marginLeft: 4,
  marginTop: 2,
}
export default SettingsNav
