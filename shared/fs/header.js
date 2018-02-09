// @flow
import * as React from 'react'
import {globalStyles, globalColors, globalMargins, isMobile} from '../styles'
import {Avatar, Box, ClickableBox, Icon, Text} from '../common-adapters'
import HeaderConnector from './header-container'

type FolderHeaderProps = {
  items: Array<{
    name: string,
    path: string,
  }>,
  isTeamPath: boolean,
  onOpenBreadcrumb: (path: string) => void,
}

const FolderHeader = HeaderConnector(({items, isTeamPath, onOpenBreadcrumb}: FolderHeaderProps) => (
  <Box>
    {items.length === 1 ? (
      <Box style={folderHeaderStyleRoot}>
        <Text type="BodyBig">Keybase Files</Text>
      </Box>
    ) : (
      <Box style={folderHeaderStyleTree}>
        {items.length < 10 &&
          items.map((i, idx) => (
            <Box key={i.path} style={folderBreadcrumbStyle}>
              {idx !== 0 && <Icon type="iconfont-back" style={iconStyle} />}
              {idx === 2 &&
                isTeamPath && <Avatar size={12} teamname={i.name} isTeam={true} style={styleTeamAvatar} />}
              {idx === items.length - 1 ? (
                <Text type="BodyBig">{i.name}</Text>
              ) : (
                <ClickableBox onClick={() => onOpenBreadcrumb(i.path)}>
                  <Text type="BodySmallSemibold" style={styleParentBreadcrumb}>
                    {i.name}
                  </Text>
                </ClickableBox>
              )}
            </Box>
          ))}
      </Box>
    )}
  </Box>
))

const stylesCommonRow = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: 1,
  minHeight: isMobile ? 64 : 48,
}

const folderHeaderStyleRoot = {
  ...stylesCommonRow,
  alignItems: 'center',
  justifyContent: 'center',
}

const folderHeaderStyleTree = {
  ...stylesCommonRow,
  alignItems: 'center',
  paddingLeft: 16,
  paddingRight: 16,
}

const folderBreadcrumbStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: 0,
  paddingRight: 0,
}

const styleParentBreadcrumb = {color: globalColors.black_60}

const iconStyle = {
  fontSize: 11,
  marginLeft: globalMargins.xtiny,
  marginRight: globalMargins.xtiny,
}

const styleTeamAvatar = {
  marginRight: globalMargins.xtiny,
}

export default FolderHeader
