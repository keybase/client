import * as React from 'react'
import SettingsNav from './nav'
import {Box} from '../common-adapters'
import {globalStyles} from '../styles'

import {Props} from './render'

const SettingsRender = (props: Props) => {
  const {loadHasRandomPW} = props
  React.useEffect(() => {
    loadHasRandomPW()
  }, [loadHasRandomPW])
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, height: '100%'}}>
      <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
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

export default SettingsRender
