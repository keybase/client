// @flow
import * as React from 'react'
import * as Constants from '../../constants/settings'
import flags from '../../util/feature-flags'
import {platformStyles, globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Badge, ClickableBox, Text} from '../../common-adapters'

import type {Props, SettingsItem as SettingsItemType} from './index'

function SettingsItem({text, selected, onClick, badgeNumber}: SettingsItemType) {
  return (
    <ClickableBox onClick={onClick} style={selected ? selectedStyle : itemStyle}>
      <Box style={globalStyles.flexBoxRow}>
        <Text type={'BodySmallSemibold'} style={selected ? selectedTextStyle : itemTextStyle}>
          {text}
        </Text>
        {!!badgeNumber && badgeNumber > 0 && <Badge badgeStyle={badgeStyle} badgeNumber={badgeNumber} />}
      </Box>
    </ClickableBox>
  )
}

function SettingsNav({badgeNumbers, selectedTab, onTabChange, onLogout}: Props) {
  return (
    <Box style={styleNavBox}>
      <SettingsItem
        text="Your Account"
        selected={selectedTab === Constants.landingTab}
        badgeNumber={0}
        onClick={() => onTabChange(Constants.landingTab)}
      />
      <SettingsItem
        text="Invitations"
        selected={selectedTab === Constants.invitationsTab}
        badgeNumber={0}
        onClick={() => onTabChange(Constants.invitationsTab)}
      />
      <SettingsItem
        text="Notifications"
        selected={selectedTab === Constants.notificationsTab}
        badgeNumber={0}
        onClick={() => onTabChange(Constants.notificationsTab)}
      />
      <SettingsItem
        text="Advanced"
        selected={selectedTab === Constants.advancedTab}
        badgeNumber={0}
        onClick={() => onTabChange(Constants.advancedTab)}
      />
      {flags.fsEnabled && (
        <SettingsItem
          text="Files"
          selected={selectedTab === Constants.fsTab}
          onClick={() => onTabChange(Constants.fsTab)}
        />
      )}
      <SettingsItem
        text="Delete Me"
        selected={selectedTab === Constants.deleteMeTab}
        badgeNumber={0}
        onClick={() => onTabChange(Constants.deleteMeTab)}
      />
      <SettingsItem text="Sign out" selected={false} badgeNumber={0} onClick={onLogout} />
      {__DEV__ && (
        <SettingsItem
          text="😎 &nbsp; Dev Menu"
          selected={selectedTab === Constants.devMenuTab}
          onClick={() => onTabChange(Constants.devMenuTab)}
        />
      )}
    </Box>
  )
}
const styleNavBox = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  borderRight: '1px solid ' + globalColors.black_05,
  width: 144,
}
const itemStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    height: 32,
    width: '100%',
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    alignItems: 'center',
    position: 'relative',
  },
  isElectron: {
    textTransform: 'uppercase',
  },
})

const selectedStyle = platformStyles({
  common: itemStyle,
  isElectron: {
    borderLeft: '3px solid ' + globalColors.blue,
  },
})

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
