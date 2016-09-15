// @flow
import React, {Component} from 'react'
import {globalStyles} from '../../styles'
import {Box} from '../../common-adapters'

import type {Props, BannerType, SettingsItem as SettingsItemType} from './index'

function Banner ({element, type}: {element: React$Element<*>, type: BannerType}) {
  return null
}

function SettingsItem ({item}: {item: SettingsItemType}) {
  return null
}

class SettingsNav extends Component<void, Props, void> {
  render () {
    const {bannerElement, bannerType, items} = this.props
    return (
      <Box style={globalStyles.flexBoxColumn}>
        {!!bannerElement && <Banner element={bannerElement} type={bannerType || 'green'} />}
        <Box style={globalStyles.flexBoxRow}>
          <Box style={globalStyles.flexBoxColumn}>
            {items.map(i => <SettingsItem key={i.text} item={i} />)}
          </Box>
          <Box style={{flex: 1, backgroundColor: 'black'}} />
        </Box>
      </Box>
    )
  }
}

const commonBannerStyle = {
  'red': {},
  'green': {},
}

const variantBannerStyle = {
  'red': {},
  'green': {},
}

export default SettingsNav
