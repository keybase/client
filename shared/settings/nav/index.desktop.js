// @flow
import React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Badge, ClickableBox, Text} from '../../common-adapters'
import {
  landingTab,
  updatePaymentTab,
  invitationsTab,
  notificationsTab,
  deleteMeTab,
  devMenuTab,
} from '../../constants/settings'

import type {Props, SettingsItem as SettingsItemType} from './index'

export function SettingsItem ({text, selected, onClick, badgeNumber}: SettingsItemType) {
  return (
    <ClickableBox onClick={onClick} style={itemStyle}>
      <Text style={{color: selected ? globalColors.black_75 : globalColors.black_60, textTransform: 'uppercase'}} type={'BodySmallSemibold'}>{text}</Text>
      {!!selected && <Box style={selectedStyle} />}
      {!!badgeNumber && badgeNumber > 0 && <Badge badgeStyle={badgeStyle} badgeNumber={badgeNumber} />}
    </ClickableBox>
  )
}

function SettingsNav ({selectedTab, onTabChange}: Props) {
  return (
    <Box style={globalStyles.flexBoxColumn}>
      <SettingsItem
        text='Your Account'
        selected={selectedTab === landingTab}
        onClick={() => onTabChange(landingTab)}
      />
      <SettingsItem
        text='Update Payment'
        selected={selectedTab === updatePaymentTab}
        onClick={() => onTabChange(updatePaymentTab)}
      />
      <SettingsItem
        text='Invitations'
        selected={selectedTab === invitationsTab}
        onClick={() => onTabChange(invitationsTab)}
      />
      <SettingsItem
        text='Notifications'
        selected={selectedTab === notificationsTab}
        onClick={() => onTabChange(notificationsTab)}
      />
      <SettingsItem
        text='Delete Me'
        selected={selectedTab === deleteMeTab}
        onClick={() => onTabChange(deleteMeTab)}
      />
      {__DEV__ &&
        <SettingsItem
          text='😎 Dev Menu'
          selected={selectedTab === devMenuTab}
          onClick={() => onTabChange(devMenuTab)}
        />
      }
    </Box>
  )
}

const itemStyle = {
  ...globalStyles.flexBoxRow,
  height: 40,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  alignItems: 'center',
  position: 'relative',
}

const selectedStyle = {
  backgroundColor: globalColors.blue,
  height: 2,
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
}

const badgeStyle = {
  marginRight: 0,
  marginLeft: 4,
  marginTop: 2,
}

export default SettingsNav
