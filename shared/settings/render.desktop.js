// @flow
import React from 'react'
import SettingsNav from './nav'
import {Box} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'
import SettingsHelp from './help.desktop'

import type {BannerType, Props} from './render'

function Banner ({element, type}: {element: React$Element<*>, type: BannerType}) {
  return (
    <Box style={{...commonBannerStyle, ...variantBannerStyle[type]}}>
      {element}
    </Box>
  )
}

function SettingsRender (props: Props) {
  if (props.showComingSoon) {
    return <SettingsHelp />
  }

  return (
    <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
      {!!props.bannerElement && <Banner element={props.bannerElement} type={props.bannerType || 'green'} />}
      {!props.isModal && <SettingsNav selectedTab={props.selectedTab} onTabChange={props.onTabChange} />}
      <Box style={{...globalStyles.flexBoxRow, flex: 1, overflow: 'auto'}}>
        {props.children}
      </Box>
    </Box>
  )
}

const commonBannerStyle = {
  ...globalStyles.flexBoxRow,
  minHeight: 48,
}

const variantBannerStyle = {
  'red': {backgroundColor: globalColors.red},
  'green': {backgroundColor: globalColors.green},
}

export default SettingsRender
