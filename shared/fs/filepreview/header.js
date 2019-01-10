// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalMargins, platformStyles} from '../../styles'
import {Box, Text, BackButton} from '../../common-adapters'
import * as Kbfs from '../common'
import {isMobile} from '../../constants/platform'

type HeaderProps = {
  path: Types.Path,
  name: string,

  onBack: () => void,
}

const Header = (props: HeaderProps) => (
  <Box style={globalStyles.flexBoxRow}>
    <BackButton key="back" onClick={props.onBack} style={stylesClose} />
    <Box style={filePreviewHeaderStyle}>
      <Text type="BodyBig" selectable={true}>
        {props.name}
      </Text>
      {!isMobile && <Kbfs.PathItemInfo path={props.path} startWithLastModified={true} />}
    </Box>
    <Box style={stylesHeaderIcons}>
      <Kbfs.OpenInSystemFileManager path={props.path} />
      <Kbfs.SendInAppAction path={props.path} sendIconClassName="" />
      <Kbfs.PathItemAction path={props.path} fontSize={16} />
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
  borderBottomWidth: 0,
  height: 48,
  justifyContent: 'center',
}

const stylesHeaderIcons = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  marginRight: globalMargins.small,
}

export default Header
