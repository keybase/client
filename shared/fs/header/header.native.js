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
    <Box style={stylesFolderHeaderRoot}>
      <Text type="BodyBig">{title}</Text>
    </Box>
    <BackButton title={null} onClick={onBack} />
    <AddNew path={path} style={stylesAddNew} />
  </Box>
)

const stylesFolderHeaderContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 64,
}

const stylesFolderHeaderRoot = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  position: 'absolute',
  minHeight: 48,
}

const stylesAddNew = {
  padding: globalMargins.tiny,
  paddingRight: globalMargins.small - 4,
  paddingLeft: globalMargins.small,
}

export default Header
