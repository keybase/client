// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {BackButton, Box, Text} from '../../common-adapters'

type Props = {
  title: string,
  onBack: () => void,
}

const Header = ({title, onBack}: Props) => (
  <Box style={stylesFolderHeaderContainer}>
    <Box style={stylesFolderHeaderRoot}>
      <Text type="BodyBig">{title}</Text>
    </Box>
    <BackButton title={null} onClick={onBack} style={stylesBackButton} />
  </Box>
)

const stylesFolderHeaderContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'space-between',
  flex: 1,
}

const stylesFolderHeaderRoot = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  position: 'absolute',
  minHeight: 64,
}

const stylesBackButton = {
  marginLeft: globalMargins.small,
}

export default Header
