// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalMargins} from '../../styles'
import {BackButton, Box, Text} from '../../common-adapters'
import AddNew from './add-new-container'

type Props = {
  path: Types.Path,
  title: string,
  onBack: () => void,
}

const Header = ({title, path, onBack}: Props) => (
  <Box style={stylesFolderHeaderContainer}>
    <BackButton onClick={onBack} />
    <Box style={stylesFolderHeaderRoot}>
      <Text type="BodyBig" style={stylesTitle}>
        {title}
      </Text>
    </Box>
    <Box style={stylesAddNewBox}>
      <AddNew path={path} style={stylesAddNew} />
    </Box>
  </Box>
)

const stylesFolderHeaderContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  paddingTop: 12,
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
