// @flow
import * as React from 'react'
import * as TabConstants from '../../constants/tabs'
import * as Constants from '../../constants/settings'
import {globalStyles, globalColors, globalMargins, styleSheetCreate} from '../../styles'
import {HeaderHoc, NativeSectionList, Text} from '../../common-adapters/mobile.native'
import {isAndroid} from '../../constants/platform'
import flags from '../../util/feature-flags'
import SettingsItem from './settings-item'

import type {Props} from './index'

// <Badge2 radius={11} topBottomPadding={0} badgeStyle={styles.badge} badgeNumber={badgeNumber} />

const renderItem = ({item}) => {
  return item.text ? <SettingsItem {...item} /> : null
}

function SettingsNav({badgeNotifications, badgeNumbers, selectedTab, onTabChange, onLogout}: Props) {
  return (
    <NativeSectionList
      keyExtractor={(item, index) => item.text + index}
      renderItem={renderItem}
      renderSectionHeader={({section: {title}}) =>
        title ? (
          <Text type="BodySmallSemibold" style={styles.sectionTitle}>
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
              onClick: () => onTabChange(Constants.fsTab),
              text: 'Files',
            },
            {
              badgeNumber: badgeNumbers[TabConstants.gitTab],
              icon: 'iconfont-nav-git',
              onClick: () => onTabChange(Constants.gitTab),
              text: 'Git',
            },
            {
              badgeNumber: badgeNumbers[TabConstants.devicesTab],
              icon: 'iconfont-nav-devices',
              onClick: () => onTabChange(Constants.devicesTab),
              text: 'Devices',
            },
            {
              ...(flags.walletsEnabled
                ? {
                    badgeNumber: badgeNumbers[TabConstants.walletsTab],
                    icon: 'iconfont-nav-wallets',
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

const styles = styleSheetCreate({
  sectionTitle: {
    backgroundColor: globalColors.blue5,
    color: globalColors.black_40,
    paddingBottom: 7,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    paddingTop: 7,
  },
})

export default HeaderHoc(SettingsNav)
