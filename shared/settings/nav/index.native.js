// @flow
import * as React from 'react'
import * as TabConstants from '../../constants/tabs'
import * as Constants from '../../constants/settings'
import {StyleSheet} from 'react-native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Badge, ClickableBox, Text, HeaderHoc, NativeScrollView} from '../../common-adapters/index.native'
import {isAndroid} from '../../constants/platform'
import {compose, defaultProps} from 'recompose'
import flags from '../../util/feature-flags'

import type {Props} from './index'

export function SettingsItem({
  text,
  onClick,
  badgeNumber,
}: {
  text: string,
  onClick: () => void,
  badgeNumber: number,
}) {
  return (
    <ClickableBox onClick={onClick} style={itemStyle}>
      <Box style={{...globalStyles.flexBoxRow}}>
        <Text type={'BodySmallSemibold'} style={itemTextStyle}>{text.toUpperCase()}</Text>
        {!!badgeNumber && badgeNumber > 0 && <Badge badgeStyle={badgeStyle} badgeNumber={badgeNumber} />}
      </Box>
    </ClickableBox>
  )
}

function SettingsNav({badgeNumbers, selectedTab, onTabChange, onLogout}: Props) {
  return (
    <NativeScrollView style={{width: '100%', height: '100%'}}>
      <Box style={styleNavBox}>
        {flags.teamChatEnabled &&
          <SettingsItem
            text="Folders"
            badgeNumber={badgeNumbers[TabConstants.folderTab]}
            onClick={() => onTabChange(Constants.foldersTab)}
          />}
        <SettingsItem
          text="Git"
          badgeNumber={badgeNumbers[TabConstants.gitTab]}
          onClick={() => onTabChange(Constants.gitTab)}
        />
        <SettingsItem
          text="Devices"
          badgeNumber={badgeNumbers[TabConstants.devicesTab]}
          onClick={() => onTabChange(Constants.devicesTab)}
        />
        <SettingsItem
          text="Notifications"
          badgeNumber={0}
          onClick={() => onTabChange(Constants.notificationsTab)}
        />
        <SettingsItem
          text="Passphrase"
          badgeNumber={0}
          onClick={() => onTabChange(Constants.passphraseTab)}
        />
        <SettingsItem text="About" badgeNumber={0} onClick={() => onTabChange(Constants.aboutTab)} />
        <SettingsItem text="Feedback" badgeNumber={0} onClick={() => onTabChange(Constants.feedbackTab)} />
        {isAndroid &&
          <SettingsItem
            text="Screen Protector"
            badgeNumber={0}
            onClick={() => onTabChange(Constants.screenprotectorTab)}
          />}
        <SettingsItem text="Sign out" badgeNumber={0} onClick={onLogout} />
        {__DEV__ &&
          <SettingsItem
            text="😎 &nbsp; Dev Menu"
            badgeNumber={0}
            onClick={() => onTabChange(Constants.devMenuTab)}
          />}
      </Box>
    </NativeScrollView>
  )
}
const styleNavBox = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.white,
  borderBottomColor: globalColors.black_05,
}
const itemStyle = {
  ...globalStyles.flexBoxRow,
  height: 64,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  alignItems: 'center',
  position: 'relative',
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
export default compose(defaultProps({title: 'SETTINGS'}), HeaderHoc)(SettingsNav)
