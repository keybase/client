// @flow
import * as React from 'react'
import * as TabConstants from '../../constants/tabs'
import * as Constants from '../../constants/settings'
import {StyleSheet} from 'react-native'
import {globalStyles, globalColors, globalMargins, type Color} from '../../styles'
import {
  Badge,
  Box,
  ClickableBox,
  HeaderHoc,
  Icon,
  NativeSectionList,
  Text,
} from '../../common-adapters/mobile.native'
import {isAndroid} from '../../constants/platform'
import flags from '../../util/feature-flags'

import type {Props} from './index'

function SettingsItem({
  badgeNumber,
  icon,
  largerBadgeMinWidthFix,
  onClick,
  text,
  textColor,
}: {
  badgeNumber: number,
  icon?: any,
  largerBadgeMinWidthFix?: true,
  onClick: () => void,
  text: string,
  textColor?: Color,
}) {
  return text ? (
    <ClickableBox onClick={onClick} style={itemStyle}>
      <Box style={{...globalStyles.flexBoxRow}}>
        {icon && (
          <Icon type={icon} color={globalColors.black_20} style={{marginRight: globalMargins.small}} />
        )}
        <Text
          type="BodySemibold"
          style={{color: textColor || globalColors.black_75, position: 'relative', top: 3}}
        >
          {text}
        </Text>
        {!!badgeNumber && badgeNumber > 0 && <Badge badgeStyle={badgeStyle} badgeNumber={badgeNumber} />}
      </Box>
    </ClickableBox>
  ) : null
}

const renderItem = ({item}) => {
  return <SettingsItem {...item} />
}

function SettingsNav({badgeNotifications, badgeNumbers, selectedTab, onTabChange, onLogout}: Props) {
  return (
    <NativeSectionList
      keyExtractor={(item, index) => item.text + index}
      renderItem={renderItem}
      renderSectionHeader={({section: {title}}) =>
        title ? (
          <Text type="BodySmallSemibold" style={sectionTitleStyle}>
            {title}
          </Text>
        ) : null
      }
      style={globalStyles.fullHeight}
      sections={[
        {
          data: [
            {
              badgeNumber: badgeNumbers[TabConstants.fsTab],
              icon: 'iconfont-nav-files',
              largerBadgeMinWidthFix: true,
              onClick: () => onTabChange(Constants.fsTab),
              text: 'Files',
            },
            {
              badgeNumber: badgeNumbers[TabConstants.gitTab],
              icon: 'iconfont-nav-git',
              largerBadgeMinWidthFix: true,

              onClick: () => onTabChange(Constants.gitTab),
              text: 'Git',
            },
            {
              badgeNumber: badgeNumbers[TabConstants.devicesTab],
              icon: 'iconfont-nav-devices',
              largerBadgeMinWidthFix: true,

              onClick: () => onTabChange(Constants.devicesTab),
              text: 'Devices',
            },
            {
              ...(flags.walletsEnabled
                ? {
                    badgeNumber: badgeNumbers[TabConstants.walletsTab],
                    icon: 'iconfont-nav-wallets',
                    largerBadgeMinWidthFix: true,

                    onClick: () => onTabChange(Constants.walletsTab),
                    text: 'Wallet',
                  }
                : {}),
            },
            {
              ...(__DEV__
                ? {
                    badgeNumber: 0,
                    icon: 'iconfont-nav-settings',
                    largerBadgeMinWidthFix: true,
                    onClick: () => onTabChange(Constants.devMenuTab),
                    text: 'Dev menu',
                  }
                : {}),
            },
          ],
          title: '',
        },
        {
          data: [
            {
              badgeNumber: badgeNotifications ? 1 : 0,
              onClick: () => onTabChange(Constants.notificationsTab),
              text: 'Notifications',
            },
            {
              badgeNumber: 0,
              onClick: () => onTabChange(Constants.passphraseTab),
              text: 'Change passphrase',
            },
            {
              ...(isAndroid
                ? {
                    badgeNumber: 0,
                    onClick: () => onTabChange(Constants.screenprotectorTab),
                    text: 'Screen Protector',
                  }
                : {}),
            },
          ],
          title: 'Settings',
        },
        {
          data: [
            {
              badgeNumber: 0,
              onClick: () => onTabChange(Constants.aboutTab),
              text: 'About',
            },
            {
              badgeNumber: 0,
              onClick: () => onTabChange(Constants.feedbackTab),
              text: 'Feedback',
            },
            {
              badgeNumber: 0,
              onClick: () => onTabChange(Constants.advancedTab),
              text: 'Advanced',
            },
            {
              badgeNumber: 0,
              onClick: onLogout,
              text: 'Sign out',
              textColor: globalColors.red,
            },
          ],
          title: 'More',
        },
      ]}
    />
  )
}

const itemStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: StyleSheet.hairlineWidth,
  height: 56,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  position: 'relative',
}

const badgeStyle = {
  marginLeft: 4,
  marginRight: 0,
  marginTop: 2,
}

const sectionTitleStyle = {
  backgroundColor: globalColors.blue5,
  color: globalColors.black_40,
  paddingBottom: 7,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  paddingTop: 7,
}

export default HeaderHoc(SettingsNav)
