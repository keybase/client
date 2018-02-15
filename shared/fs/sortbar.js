// @flow
import * as React from 'react'
import {globalStyles, globalColors, isMobile} from '../styles'
import {Box, ClickableBox, Divider, Text, Icon} from '../common-adapters'
import {type IconType} from '../common-adapters/icon'
import * as Types from '../constants/types/fs'
import {compose, withProps, withHandlers} from '../util/container'

export type SortBarProps = {
  sortSettingText: string,
  sortSettingIconType: IconType,
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

const SortBar = ({
  sortSettingText,
  sortSettingIconType,
  setSortByNameAsc,
  setSortByNameDesc,
  setSortByTimeAsc,
  setSortByTimeDesc,
}: SortBarProps) => (
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
      <ClickableBox onClick={setSortByNameAsc}>
        <Text type="BodySmall" style={{marginLeft: '8px', color: 'red'}}>
          name-asc
        </Text>
      </ClickableBox>
      <ClickableBox onClick={setSortByNameDesc}>
        <Text type="BodySmall" style={{marginLeft: '8px', color: 'red'}}>
          name-desc
        </Text>
      </ClickableBox>
      <ClickableBox onClick={setSortByTimeAsc}>
        <Text type="BodySmall" style={{marginLeft: '8px', color: 'red'}}>
          time-asc
        </Text>
      </ClickableBox>
      <ClickableBox onClick={setSortByTimeDesc}>
        <Text type="BodySmall" style={{marginLeft: '8px', color: 'red'}}>
          time-desc
        </Text>
      </ClickableBox>
    </Box>
  </Box>
)

export default compose(
  withProps(({sortSetting}) => Types.sortSettingToIconTypeAndText(sortSetting)),
  withHandlers({
    setSortByNameAsc: props => () => props.setSortSetting({sortBy: 'name', sortOrder: 'asc'}),
    setSortByNameDesc: props => () => props.setSortSetting({sortBy: 'name', sortOrder: 'desc'}),
    setSortByTimeAsc: props => () => props.setSortSetting({sortBy: 'time', sortOrder: 'asc'}),
    setSortByTimeDesc: props => () => props.setSortSetting({sortBy: 'time', sortOrder: 'desc'}),
  })
)(SortBar)
