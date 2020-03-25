import * as React from 'react'
import * as Container from '../util/container'
import SettingsNav from './nav'
import {Box} from '../common-adapters'
import {globalStyles} from '../styles'
import {Tab} from '../constants/tabs'
import {SettingsTab} from '../constants/settings'

type Props = {
  badgeNotifications: boolean
  badgeNumbers: Map<Tab, number>
  children: React.ReactNode
  hasRandomPW?: boolean
  loadHasRandomPW: () => void
  contactsLabel: string
  logoutInProgress: boolean
  onLogout: () => void
  onTabChange: (tab: SettingsTab) => void
  selectedTab: SettingsTab
}

const SettingsRender = (props: Props) => {
  const {loadHasRandomPW} = props
  React.useEffect(() => {
    loadHasRandomPW()
  }, [loadHasRandomPW])
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, height: '100%'}}>
      <Box style={{...globalStyles.flexBoxRow, flex: 1, height: '100%'}}>
        <SettingsNav
          badgeNumbers={props.badgeNumbers}
          contactsLabel={props.contactsLabel}
          logoutInProgress={props.logoutInProgress}
          selectedTab={props.selectedTab}
          onTabChange={props.onTabChange}
          onLogout={props.onLogout}
          hasRandomPW={props.hasRandomPW || null}
        />
        <Box style={{...globalStyles.flexBoxRow, flex: 1, height: '100%', overflow: 'auto'}}>
          {props.children}
        </Box>
      </Box>
    </Box>
  )
}
SettingsRender.navigationOptions = {
  header: null,
}

const PhoneRender = (props: Props) => {
  const {loadHasRandomPW} = props
  React.useEffect(() => {
    loadHasRandomPW()
  }, [loadHasRandomPW])

  return (
    <SettingsNav
      badgeNotifications={props.badgeNotifications}
      badgeNumbers={props.badgeNumbers}
      contactsLabel={props.contactsLabel}
      logoutInProgress={props.logoutInProgress}
      selectedTab={props.selectedTab}
      onTabChange={props.onTabChange}
      onLogout={props.onLogout}
      hasRandomPW={props.hasRandomPW || null}
    />
  )
}

PhoneRender.navigationOptions = {
  header: undefined,
  title: 'More',
}

export default Container.isPhone ? PhoneRender : SettingsRender
