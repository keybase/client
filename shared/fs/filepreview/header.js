// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalMargins, platformStyles} from '../../styles'
import {Box, Icon, Text, BackButton} from '../../common-adapters'
import PathItemInfo from '../common/path-item-info'
import {isMobile} from '../../constants/platform'

type HeaderProps = {
  pathItem: Types.PathItemMetadata,

  onAction: (evt?: SyntheticEvent<>) => void,
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
      {!isMobile && <Icon type="iconfont-finder" style={stylesHeaderIcon} onClick={props.onShowInFileUI} />}
      <Icon type="iconfont-ellipsis" style={stylesHeaderIcon} onClick={props.onAction} />
    </Box>
  </Box>
)

const stylesClose = {
  marginLeft: globalMargins.tiny,
}

const filePreviewHeaderStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.flexGrow,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 0,
  },
  isMobile: {
    height: 64,
  },
  isElectron: {
    height: 48,
  },
})

const stylesHeaderIcons = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const stylesHeaderIcon = {
  fontSize: 16,
  marginRight: globalMargins.small,
}

export default Header
