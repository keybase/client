// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, Badge, ClickableBox, Text} from '../../common-adapters'

import type {Props, BannerType, SettingsItem as SettingsItemType} from './index'

function Banner ({element, type}: {element: React$Element<*>, type: BannerType}) {
  return (
    <Box style={{...commonBannerStyle, ...variantBannerStyle[type]}}>
      {element}
    </Box>
  )
}

function SettingsItem ({text, selected, onClick, badgeNumber}: SettingsItemType) {
  return (
    <ClickableBox onClick={onClick} style={itemStyle}>
      <Text style={{color: selected ? globalColors.black_75 : globalColors.black_60}} type={'BodySmallSemibold'}>{text}</Text>
      {!!selected && <Box style={selectedStyle} />}
      {!!badgeNumber && badgeNumber > 0 && <Badge badgeStyle={badgeStyle} badgeNumber={badgeNumber} />}
    </ClickableBox>

  )
}

class SettingsNav extends Component<void, Props, void> {
  render () {
    const {content, bannerElement, bannerType, items} = this.props
    return (
      <Box style={globalStyles.flexBoxColumn}>
        {!!bannerElement && <Banner element={bannerElement} type={bannerType || 'green'} />}
        <Box style={globalStyles.flexBoxRow}>
          <Box style={globalStyles.flexBoxColumn}>
            {items.map(i => <SettingsItem key={i.text} {...i} />)}
          </Box>
          <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
            {content}
          </Box>
        </Box>
      </Box>
    )
  }
}

const commonBannerStyle = {
  ...globalStyles.flexBoxRow,
  minHeight: 48,
}

const variantBannerStyle = {
  'red': {backgroundColor: globalColors.red},
  'green': {backgroundColor: globalColors.green},
}

const itemStyle = {
  ...globalStyles.flexBoxRow,
  height: 40,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  alignItems: 'center',
  position: 'relative',
}

const selectedStyle = {
  backgroundColor: globalColors.blue,
  height: 2,
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
}

const badgeStyle = {
  marginRight: 0,
  marginLeft: 4,
  marginTop: 2,
}

export default SettingsNav
