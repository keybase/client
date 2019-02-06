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

const renderItem = ({item}) => {
  return item.text ? <SettingsItem {...item} /> : null
}

function SettingsNav(props: Props) {
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
              badgeNumber: props.badgeNumbers[TabConstants.fsTab],
              icon: 'iconfont-nav-files',
              onClick: () => props.onTabChange(Constants.fsTab),
              text: 'Files',
            },
            {
              badgeNumber: props.badgeNumbers[TabConstants.gitTab],
              icon: 'iconfont-nav-git',
              onClick: () => props.onTabChange(Constants.gitTab),
              text: 'Git',
            },
            {
              badgeNumber: props.badgeNumbers[TabConstants.devicesTab],
              icon: 'iconfont-nav-devices',
              onClick: () => props.onTabChange(Constants.devicesTab),
              text: 'Devices',
            },
            {
              ...(flags.walletsEnabled
                ? {
                    badgeNumber: props.badgeNumbers[TabConstants.walletsTab],
                    icon: 'iconfont-nav-wallets',
                    onClick: () => props.onTabChange(Constants.walletsTab),
                    text: 'Wallet',
                  }
                : {}),
            },
          ],
          title: '',
        },
        {
          data: [
            {
              onClick: () => props.onTabChange(Constants.chatTab),
              text: 'Chat',
            },
            {
              badgeNumber: props.badgeNotifications ? 1 : 0,
              onClick: () => props.onTabChange(Constants.notificationsTab),
              text: 'Notifications',
            },
            {
              onClick: () => props.onTabChange(Constants.passphraseTab),
              text: props.hasRandomPW ? 'Set a passphrase' : 'Change passphrase',
              textColor: props.hasRandomPW ? globalColors.red : undefined,
            },
            {
              ...(isAndroid
                ? {
                    onClick: () => props.onTabChange(Constants.screenprotectorTab),
                    text: 'Screen Protector',
                  }
                : {}),
            },
          ],
          title: 'Settings',
        },
        {
          data: [
            {onClick: () => props.onTabChange(Constants.aboutTab), text: 'About'},
            {onClick: () => props.onTabChange(Constants.feedbackTab), text: 'Feedback'},
            {onClick: () => props.onTabChange(Constants.advancedTab), text: 'Advanced'},
            {
              inProgress: props.logoutInProgress,
              onClick: props.onLogout,
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
    color: globalColors.black_50,
    paddingBottom: 7,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    paddingTop: 7,
  },
})

export default HeaderHoc(SettingsNav)
