// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box} from '../../common-adapters'
import Footer from '../footer/container'
import {isMobile} from '../../constants/platform'
import Header from './header-container'
import FileView from './file-view-container'
import DefaultView from './default-view-container'

type FilePreviewProps = {
  routeProps: I.RecordOf<{path: string}>,
}

const FilePreview = ({routeProps}: FilePreviewProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  return (
    <Box style={styleOuterContainer}>
      <Header path={path} />
      <Box style={stylesGreyContainer}>
        <Box style={stylesContentContainer}>
          {Types.inferFileTypeFromName(Types.getPathName(path)) === 'unknown' ? (
            <DefaultView path={path} />
          ) : (
            <FileView path={path} />
          )}
        </Box>
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
