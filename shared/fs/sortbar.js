// @flow
import * as React from 'react'
import {globalStyles, globalColors, isMobile} from '../styles'
import {Box, ClickableBox, Divider} from '../common-adapters'
import * as Constants from '../constants/fs'
import * as Types from '../constants/types/fs'

export type OnSortSettingChange = (setting: Types._SortSetting) => void

export type SortBarProps = {
  onSortSettingChange: OnSortSettingChange,
  sortSetting: Types._SortSetting,
}

export const SortBar = ({onSortSettingChange, sortSetting}: SortBarProps) => (
  <Box>
    <Divider />
    <Box style={stylesSortBar}>
      Super Ugly Temporary SortBar:
      <ClickableBox
        onClick={() =>
          onSortSettingChange(
            Constants.makeSortSetting({
              sortBy: sortSetting.sortBy,
              sortOrder: sortSetting.sortOrder === 'asc' ? 'desc' : 'asc',
            })
          )
        }
        style={{marginLeft: '8px', color: 'red'}}
      >
        Click to change sort-order: {sortSetting.sortOrder}
      </ClickableBox>
      <ClickableBox
        onClick={() =>
          onSortSettingChange({
            sortBy: sortSetting.sortBy === 'name' ? 'time' : sortSetting.sortBy === 'time' ? 'size' : 'name',
            sortOrder: sortSetting.sortOrder,
          })
        }
        style={{marginLeft: '8px', color: 'blue'}}
      >
        Click to change sort-by: {sortSetting.sortBy}
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
