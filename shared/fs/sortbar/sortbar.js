// @flow
import * as React from 'react'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../styles'
import {Box, ClickableBox, Divider, Text, Icon} from '../../common-adapters'
import * as Types from '../../constants/types/fs'

const stylesSortBar = {
  ...globalStyles.flexBoxRow,
  backgroundColor: globalColors.blue5,
  borderTopColor: globalColors.black_05,
  borderTopWidth: 1,
  paddingLeft: 16,
}

const stylesSortSetting = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'flex-start',
  minHeight: isMobile ? 24 : 24,
}

const stylesIcon = {
  marginRight: globalMargins.xtiny,
  fontSize: 11,
}

const iconBoxStyle = {
  marginTop: 4,
}

const stylesLoading = {
  ...globalStyles.flexBoxRow,
  marginLeft: 'auto',
  marginRight: 32,
  alignItems: 'center',
}

export type SortBarProps = {
  sortSetting: Types._SortSetting,
  onOpenSortSettingPopup: () => void,
}

const SortBar = (props: SortBarProps) => {
  const {sortSettingIconType, sortSettingText} = Types.sortSettingToIconTypeAndText(props.sortSetting)
  return (
    <Box>
      <Divider />
      <Box style={stylesSortBar}>
        <ClickableBox onClick={props.onOpenSortSettingPopup} style={stylesSortSetting}>
          <Box style={iconBoxStyle}>
            <Icon type={sortSettingIconType} style={stylesIcon} />
          </Box>
          <Text type="BodySmallSemibold">{sortSettingText}</Text>
        </ClickableBox>
        {props.folderIsPending ? (
          <Box style={stylesLoading}>
            <Text type="BodySmall"> Loading ... </Text>
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}

export default SortBar
