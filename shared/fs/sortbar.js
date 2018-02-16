// @flow
import * as React from 'react'
import {globalStyles, globalColors, isMobile} from '../styles'
import {Box, ClickableBox, Divider, Text, Icon} from '../common-adapters'
import {type IconType} from '../common-adapters/icon'
import * as Types from '../constants/types/fs'

export type SortBarProps = {
  sortSetting: Types._SortSetting,
  setSortByNameAsc: () => void,
  setSortByNameDesc: () => void,
  setSortByTimeAsc: () => void,
  setSortByTimeDesc: () => void,
}

const stylesSortBar = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'start',
  backgroundColor: globalColors.blue5,
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  minHeight: isMobile ? 24 : 24,
  paddingLeft: '16px',
}

type sortSettingDisplayParams = {
  sortSettingText: string,
  sortSettingIconType: IconType,
}

const sortSettingToIconTypeAndText = (s: Types._SortSetting): sortSettingDisplayParams => {
  switch (s.sortBy) {
    case 'name':
      return s.sortOrder === 'asc'
        ? {
            sortSettingIconType: 'iconfont-new',
            sortSettingText: 'Name ascending',
          }
        : {
            sortSettingIconType: 'iconfont-new',
            sortSettingText: 'Name descending',
          }
    case 'time':
      return s.sortOrder === 'asc'
        ? {
            sortSettingIconType: 'iconfont-new',
            sortSettingText: 'Recent first',
          }
        : {
            sortSettingIconType: 'iconfont-new',
            sortSettingText: 'Older first',
          }
    default:
      throw new Error('invalid SortBy')
  }
}

const SortBar = (props: SortBarProps) => {
  const {sortSettingIconType, sortSettingText} = sortSettingToIconTypeAndText(props.sortSetting)
  return (
    <Box>
      <Divider />
      <Box style={stylesSortBar}>
        <Icon type={sortSettingIconType} style={{fontSize: 10}} />
        <Text type="BodySmallSemibold" style={{marginLeft: '2px'}}>
          {sortSettingText}
        </Text>
        <Text type="BodySmall" style={{marginLeft: '16px'}}>
          Not-Super Ugly Temporary SortBar:
        </Text>
        <ClickableBox onClick={props.setSortByNameAsc}>
          <Text type="BodySmall" style={{marginLeft: '8px', color: 'red'}}>
            name-asc
          </Text>
        </ClickableBox>
        <ClickableBox onClick={props.setSortByNameDesc}>
          <Text type="BodySmall" style={{marginLeft: '8px', color: 'red'}}>
            name-desc
          </Text>
        </ClickableBox>
        <ClickableBox onClick={props.setSortByTimeAsc}>
          <Text type="BodySmall" style={{marginLeft: '8px', color: 'red'}}>
            time-asc
          </Text>
        </ClickableBox>
        <ClickableBox onClick={props.setSortByTimeDesc}>
          <Text type="BodySmall" style={{marginLeft: '8px', color: 'red'}}>
            time-desc
          </Text>
        </ClickableBox>
      </Box>
    </Box>
  )
}

export default SortBar
