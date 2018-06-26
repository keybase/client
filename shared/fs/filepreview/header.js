// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalMargins, platformStyles} from '../../styles'
import {Box, Icon, Text, BackButton} from '../../common-adapters'
import PathItemInfo from '../common/path-item-info'
import {isMobile} from '../../constants/platform'
import PathItemAction from '../popups/path-item-action-container'

type HeaderProps = {
  path: Types.Path,
  pathItem: Types.PathItemMetadata,

  onBack: () => void,
  onShowInFileUI: () => void,
}

const Header = (props: HeaderProps) => (
  <Box style={globalStyles.flexBoxRow}>
    <BackButton key="back" onClick={props.onBack} style={stylesClose} />
    <Box style={filePreviewHeaderStyle}>
      <Text type="BodyBig">{props.pathItem.name}</Text>
      {!isMobile && (
        <PathItemInfo
          lastModifiedTimestamp={props.pathItem.lastModifiedTimestamp}
          lastWriter={props.pathItem.lastWriter.username}
          startWithLastModified={true}
        />
      )}
    </Box>
    <Box style={stylesHeaderIcons}>
      {!isMobile && (
        <Icon type="iconfont-finder" style={stylesHeaderIcon} onClick={props.onShowInFileUI} fontSize={16} />
      )}
      <PathItemAction path={props.path} fontSize={16} />
    </Box>
  </Box>
)

const stylesClose = platformStyles({
  isElectron: {marginLeft: globalMargins.tiny},
})

const filePreviewHeaderStyle = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  alignItems: 'center',
  height: 48,
  borderBottomWidth: 0,
  justifyContent: 'center',
}

const stylesHeaderIcons = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  marginRight: globalMargins.small,
}

const stylesHeaderIcon = {
  padding: globalMargins.tiny,
}

export default Header
