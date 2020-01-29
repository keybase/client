import * as React from 'react'
import * as TabConstants from '../../constants/tabs'
import * as Constants from '../../constants/settings'
import {keybaseFM} from '../../constants/whats-new'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters/mobile.native'
import {isAndroid} from '../../constants/platform'
import SettingsItem from './settings-item'
import WhatsNewIcon from '../../whats-new/icon/container'
import {Props} from '.'

const renderItem = ({item}) => {
  return item.text ? <SettingsItem {...item} /> : null
}

function SettingsNav(props: Props) {
  const {badgeNumbers} = props
  return (
    <Kb.NativeSectionList
      keyExtractor={(item, index) => item.text + index}
      renderItem={renderItem}
      renderSectionHeader={({section: {title}}) =>
        title ? (
          <Kb.Text type="BodySmallSemibold" style={styles.sectionTitle}>
            {title}
          </Kb.Text>
        ) : null
      }
      style={Styles.globalStyles.fullHeight}
      sections={[
        {
          data: [
            {
              badgeNumber: badgeNumbers.get(TabConstants.gitTab),
              icon: Kb.IconType.iconfont_nav_git,
              onClick: () => props.onTabChange(Constants.gitTab),
              text: 'Git',
            },
            {
              badgeNumber: badgeNumbers.get(TabConstants.devicesTab),
              icon: Kb.IconType.iconfont_nav_devices,
              onClick: () => props.onTabChange(Constants.devicesTab),
              text: 'Devices',
            },
            {
              badgeNumber: badgeNumbers.get(TabConstants.walletsTab),
              icon: Kb.IconType.iconfont_nav_wallets,
              onClick: () => props.onTabChange(Constants.walletsTab),
              text: 'Wallet',
            },
            {
              iconComponent: WhatsNewIcon,
              onClick: () => props.onTabChange(Constants.whatsNewTab),
              subText: `What's new?`,
              text: keybaseFM,
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
            {
              onClick: () => props.onTabChange(Constants.fsTab),
              text: 'Files',
            },
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
              textColor: Styles.globalColors.red,
            },
          ],
          title: 'More',
        },
      ]}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  sectionTitle: {
    backgroundColor: Styles.globalColors.blueLighter3,
    color: Styles.globalColors.black_50,
    paddingBottom: 7,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 7,
  },
}))

export default SettingsNav
