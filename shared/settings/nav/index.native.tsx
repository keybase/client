import * as React from 'react'
import * as TabConstants from '../../constants/tabs'
import * as Constants from '../../constants/settings'
import {globalStyles, globalColors, globalMargins, styleSheetCreate} from '../../styles'
import {NativeSectionList, Text} from '../../common-adapters/mobile.native'
import {isAndroid} from '../../constants/platform'
import SettingsItem from './settings-item'
import flags from '../../util/feature-flags'
import {Props} from './index'

const renderItem = ({item}) => {
  return item.text ? <SettingsItem {...item} /> : null
}

function SettingsNav(props: Props) {
  const {badgeNumbers} = props
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
              badgeNumber: badgeNumbers.get(TabConstants.gitTab),
              icon: 'iconfont-nav-git',
              onClick: () => props.onTabChange(Constants.gitTab),
              text: 'Git',
            },
            {
              badgeNumber: badgeNumbers.get(TabConstants.devicesTab),
              icon: 'iconfont-nav-devices',
              onClick: () => props.onTabChange(Constants.devicesTab),
              text: 'Devices',
            },
            {
              badgeNumber: badgeNumbers.get(TabConstants.walletsTab),
              icon: 'iconfont-nav-wallets',
              onClick: () => props.onTabChange(Constants.walletsTab),
              text: 'Wallet',
            },
          ],
          title: '',
        },
        {
          data: [
            {
              badgeNumber: badgeNumbers.get(TabConstants.settingsTab),
              onClick: () => props.onTabChange(Constants.accountTab),
              text: 'Your account',
            },
            {
              onClick: () => props.onTabChange(Constants.chatTab),
              text: 'Chat',
            },
            {
              onClick: () => props.onTabChange(Constants.contactsTab),
              text: props.contactsLabel,
            },
            ...(flags.kbfsOfflineMode
              ? [
                  {
                    onClick: () => props.onTabChange(Constants.fsTab),
                    text: 'Files',
                  },
                ]
              : []),
            {
              badgeNumber: props.badgeNotifications ? 1 : 0,
              onClick: () => props.onTabChange(Constants.notificationsTab),
              text: 'Notifications',
            },
            {
              onClick: () => props.onTabChange(Constants.displayTab),
              text: 'Display',
            },
            ...(isAndroid
              ? [
                  {
                    onClick: () => props.onTabChange(Constants.screenprotectorTab),
                    text: 'Screen protector',
                  },
                ]
              : []),
          ],
          title: 'Settings',
        },
        {
          data: [
            {onClick: () => props.onTabChange(Constants.aboutTab), text: 'About'},
            {onClick: () => props.onTabChange(Constants.feedbackTab), text: 'Feedback'},
            {onClick: () => props.onTabChange(Constants.advancedTab), text: 'Advanced'},
            {
              onClick: () => props.onTabChange(Constants.logOutTab),
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

const styles = styleSheetCreate(() => ({
  sectionTitle: {
    backgroundColor: globalColors.blueLighter3,
    color: globalColors.black_50,
    paddingBottom: 7,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    paddingTop: 7,
  },
}))

export default SettingsNav
