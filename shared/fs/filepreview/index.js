// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Text, Box} from '../../common-adapters'
import Footer from '../footer/container'
import {isMobile} from '../../constants/platform'
import Header from './header-container'
import TextView from './text-view'
import DefaultView from './default-view-container'

type FilePreviewProps = {
  routeProps: I.Map<string, any>,
}

const getDisplayComponent = (path: Types.Path, fileViewType: Types.FileViewType) => {
  switch (fileViewType) {
    case 'text':
      return <TextView url="https://keybase.io/warp/release.txt" />
    case 'default':
      return <DefaultView path={path} />
    default:
      // eslint-disable-next-line no-unused-expressions
      ;(fileViewType: empty) // this breaks when a new file view type is added but not handled here
      return <Text type="BodyError">This shouldn't happen</Text>
  }
}

const FilePreview = ({routeProps}: FilePreviewProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  const fileViewType = routeProps.get('fileViewType', Constants.viewTypeFromPath(path))
  return (
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

const stylesContentContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  ...(isMobile
    ? {}
    : {
        paddingLeft: globalMargins.medium,
        paddingRight: globalMargins.medium,
      }),
  width: '100%',
  overflow: 'scroll',
}

export default FilePreview
