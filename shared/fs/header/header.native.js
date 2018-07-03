// @flow
import * as React from 'react'
import {globalColors, globalStyles, globalMargins} from '../../styles'
import {BackButton, Box, Icon, Text} from '../../common-adapters'
import AddNew from './add-new-container'
import {type FolderHeaderProps} from './header'

const Header = ({title, path, onBack, onChat}: FolderHeaderProps) => (
  <Box style={stylesFolderHeaderContainer}>
    <Box style={stylesFolderHeaderRow}>
      <BackButton onClick={onBack} />
      <Box style={stylesFolderHeaderRoot}>
        <Text type="BodyBig" style={stylesTitle}>
          {title}
        </Text>
      </Box>
      <Box style={stylesAddNewBox}>
        <AddNew path={path} style={stylesAddNew} />
      </Box>
      {onChat && (
        <Box style={stylesAddNewBox}>
          <Icon
            type="iconfont-chat"
            style={{
              marginLeft: globalMargins.tiny,
              marginTop: globalMargins.tiny,
            }}
            color={globalColors.black_40}
            fontSize={22}
            onClick={onChat}
          />
        </Box>
      )}
    </Box>
  </Box>
)

const stylesFolderHeaderRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  paddingTop: 12,
  minHeight: 64,
}

const stylesFolderHeaderContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  minHeight: 64,
}

const stylesFolderHeaderRoot = {
  paddingTop: 9,
  paddingBottom: 21,
  flexShrink: 1,
  flexGrow: 1,
}

const stylesAddNew = {
  padding: globalMargins.tiny,
  paddingRight: globalMargins.small - 4,
  paddingLeft: globalMargins.small,
}

const stylesTitle = {
  textAlign: 'center',
}

const stylesAddNewBox = {
  minWidth: 50,
}

export default Header
