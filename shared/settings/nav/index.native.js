// @flow
import React from 'react'
import {StyleSheet} from 'react-native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Badge, ClickableBox, Text, HeaderHoc} from '../../common-adapters'
import {isAndroid} from '../../constants/platform'
import {
  devMenuTab,
  feedbackTab,
  aboutTab,
  devicesTab,
  screenprotectorTab,
} from '../../constants/settings'
import {compose, defaultProps} from 'recompose'

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

function SettingsNav ({badgeNumbers, selectedTab, onTabChange, onLogout}: Props) {
  return (
    <Box style={styleNavBox}>
      <SettingsItem
        text='Devices'
        badgeNumber={badgeNumbers[devicesTab]}
        onClick={() => onTabChange(devicesTab)}
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
      {isAndroid &&
        <SettingsItem
          text='Screen Protector'
          badgeNumber={0}
          onClick={() => onTabChange(screenprotectorTab)}
        />
      }
      <SettingsItem
        text='Sign out'
        badgeNumber={0}
        onClick={onLogout}
      />
      {__DEV__ &&
        <SettingsItem
          text='😎 &nbsp; Dev Menu'
          badgeNumber={0}
          onClick={() => onTabChange(devMenuTab)}
        />
      }
    </Box>
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
