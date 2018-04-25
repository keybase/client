// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {isMobile} from '../../constants/platform'
import {Box} from '../../common-adapters'
import Footer from '../footer/container'
import Header from './header-container'
import {getDisplayComponent} from './common'
import BareView from './bare-view'

type FilePreviewProps = {
  routeProps: I.Map<string, any>,
}

const isBare = (fileViewType: Types.FileViewType) => isMobile && ['image'].includes(fileViewType)

const FilePreview = ({routeProps}: FilePreviewProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  const fileViewType = Constants.viewTypeFromPath(path)
  return isBare(fileViewType) ? (
    <BareView path={path} fileViewType={fileViewType} />
  ) : (
    <Box style={styleOuterContainer}>
      <Header path={path} />
      <Box style={stylesGreyContainer}>
        <Box style={stylesContentContainer}>{getDisplayComponent(path, fileViewType)}</Box>
      </Box>
      <Footer />
    </Box>
  )
}

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
    overflow: 'scroll',
  },
  isElectron: {
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
  },
})

export default FilePreview
