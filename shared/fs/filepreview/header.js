// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalMargins, platformStyles} from '../../styles'
import {Box, Text, BackButton} from '../../common-adapters'
import {PathItemInfo, PathItemAction, OpenInSystemFileManager} from '../common'
import {isMobile} from '../../constants/platform'

type HeaderProps = {
  path: Types.Path,
  pathItem: Types.PathItemMetadata,

  onBack: () => void,
}

const Header = (props: HeaderProps) => (
  <Box style={globalStyles.flexBoxRow}>
    <BackButton key="back" onClick={props.onBack} style={stylesClose} />
    <Box style={filePreviewHeaderStyle}>
      <Text type="BodyBig" selectable={true}>
        {props.pathItem.name}
      </Text>
      {!isMobile && (
        <PathItemInfo
          lastModifiedTimestamp={props.pathItem.lastModifiedTimestamp}
          lastWriter={props.pathItem.lastWriter.username}
          startWithLastModified={true}
        />
      )}
    </Box>
    <Box style={stylesHeaderIcons}>
      <OpenInSystemFileManager path={props.path} />
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

export default Header
