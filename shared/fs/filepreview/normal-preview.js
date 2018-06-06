// @flow
import * as I from 'immutable'
import {mapProps} from '../../util/container'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Box} from '../../common-adapters'
import Footer from '../footer/container'
import Header from './header-container'
import View from './view-container'

type NormalPreviewProps = {
  path: Types.Path,
  routePath: I.List<string>,
}

const NormalPreview = ({path, routePath}: NormalPreviewProps) => (
  <Box style={styleOuterContainer}>
    <Header path={path} routePath={routePath} />
    <Box style={stylesGreyContainer}>
      <Box style={stylesContentContainer}>
        <View path={path} routePath={routePath} />
      </Box>
    </Box>
    <Footer />
  </Box>
)

const styleOuterContainer = {
  ...globalStyles.flexBoxColumn,
  height: '100%',
  position: 'relative',
}

const stylesGreyContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: globalColors.blue5,
}

const stylesContentContainer = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.flexGrow,
    height: '100%',
    width: '100%',
  },
  isElectron: {
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
  },
})

export default mapProps(
  ({routePath, routeProps}): NormalPreviewProps => ({
    path: Types.stringToPath(routeProps.get('path') || Constants.defaultPath),
    routePath,
  })
)(NormalPreview)
