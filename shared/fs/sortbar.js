// @flow
import * as React from 'react'
import {globalStyles, globalColors, isMobile} from '../styles'
import {Box, ClickableBox, Divider, Text} from '../common-adapters'
import * as Types from '../constants/types/fs'

export type SortBarProps = {
  toggleSortOrder: () => void,
  toggleSortBy: () => void,
  sortSetting: Types._SortSetting,
}

export const SortBar = ({toggleSortBy, toggleSortOrder, sortSetting}: SortBarProps) => (
  <Box>
    <Divider />
    <Box style={stylesSortBar}>
      <Text type="BodySmall" style={{marginLeft: '16px'}}>
        Not-Super Ugly Temporary SortBar:
      </Text>
      <ClickableBox onClick={toggleSortOrder}>
        <Text type="BodySmall" style={{marginLeft: '8px', color: 'red'}}>
          Click to change sort-order: {sortSetting.sortOrder}
        </Text>
      </ClickableBox>
      <ClickableBox onClick={toggleSortBy}>
        <Text type="BodySmall" style={{marginLeft: '8px', color: 'blue'}}>
          Click to change sort-by: {sortSetting.sortBy}
        </Text>
      </ClickableBox>
    </Box>
  </Box>
)

const stylesSortBar = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'start',
  backgroundColor: globalColors.blue5,
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  minHeight: isMobile ? 24 : 24,
}
