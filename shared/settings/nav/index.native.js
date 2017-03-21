// @flow
import React from 'react'
import {StyleSheet} from 'react-native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Badge, ClickableBox, Text} from '../../common-adapters'
import {
  landingTab,
  invitationsTab,
  notificationsTab,
  deleteMeTab,
  devMenuTab,
  feedbackTab,
  aboutTab,
  devicesTab,
} from '../../constants/settings'

import type {Props} from './index'

export function SettingsItem ({text, onClick, badgeNumber}: {text: string, onClick: () => void, badgeNumber: number}) {
  return (
    <ClickableBox onClick={onClick} style={itemStyle}>
      <Box>
        <Text type={'BodySmallSemibold'} style={itemTextStyle}>{text.toUpperCase()}</Text>
        {!!badgeNumber && badgeNumber > 0 && <Badge badgeStyle={badgeStyle} badgeNumber={badgeNumber} />}
      </Box>
    </ClickableBox>
  )
}

function SettingsNav ({badgeNumbers, selectedTab, onTabChange}: Props) {
  return (
    <Box style={styleNavBox}>
      <Box style={headerContainerStyle}>
        <Text type='Header' style={headerStyle}>SETTINGS</Text>
      </Box>
      <SettingsItem
        text='Your Account'
        badgeNumber={badgeNumbers[landingTab]}
        onClick={() => onTabChange(landingTab)}
      />
      <SettingsItem
        text='Invitations'
        badgeNumber={badgeNumbers[invitationsTab]}
        onClick={() => onTabChange(invitationsTab)}
      />
      <SettingsItem
        text='Devices'
        badgeNumber={badgeNumbers[devicesTab]}
        onClick={() => onTabChange(devicesTab)}
      />
      <SettingsItem
        text='Notifications'
        badgeNumber={badgeNumbers[notificationsTab]}
        onClick={() => onTabChange(notificationsTab)}
      />
      <SettingsItem
        text='About'
        badgeNumber={badgeNumbers[aboutTab]}
        onClick={() => onTabChange(aboutTab)}
      />
      <SettingsItem
        text='Feedback'
        badgeNumber={badgeNumbers[feedbackTab]}
        onClick={() => onTabChange(feedbackTab)}
      />
      <SettingsItem
        text='Delete Me'
        badgeNumber={badgeNumbers[deleteMeTab]}
        onClick={() => onTabChange(deleteMeTab)}
      />
      {__DEV__ &&
        <SettingsItem
          text='😎 &nbsp; Dev Menu'
          onClick={() => onTabChange(devMenuTab)}
        />
      }
    </Box>
  )
}

const headerStyle = {
  textAlign: 'center',
}

const headerContainerStyle = {
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: StyleSheet.hairlineWidth,
}

const styleNavBox = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.small,
  borderBottomColor: globalColors.black_05,
}

const itemStyle = {
  ...globalStyles.flexBoxRow,
  height: 64,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  alignItems: 'center',
  position: 'relative',
  textTransform: 'uppercase',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: StyleSheet.hairlineWidth,
}

const itemTextStyle = {
  color: globalColors.black_60,
}

const badgeStyle = {
  marginRight: 0,
  marginLeft: 4,
  marginTop: 2,
}

export default SettingsNav
