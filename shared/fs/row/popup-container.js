// @flow
import * as Types from '../../constants/types/fs'
import * as FSGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import Popup from './popup'
import {fileUIName} from '../../constants/platform.desktop'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const path = routeProps.get('path')
  const pathItem = routeProps.get('pathItem')
  const itemStyles = routeProps.get('itemStyles')

  return {
    path,
    pathItem,
    itemStyles,
    fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  showInFileUI: (path: Types.Path) => dispatch(FSGen.createOpenInFileUI({path: Types.pathToString(path)})),
  download: (path: Types.Path) => dispatch(FSGen.createDownload({path})),
})

const mergeProps = ({path, pathItem, itemStyles, fileUIEnabled}, {showInFileUI, download}) => {
  return {
    type: pathItem ? pathItem.type : 'unknown',
    lastModifiedTimestamp: pathItem.lastModifiedTimestamp,
    lastWriter: pathItem.lastWriter,
    name: pathItem.name,
    size: pathItem.size,
    itemStyles,
    menuItems: (fileUIEnabled
      ? [
          {
            title: 'Show in ' + fileUIName,
            onClick: () => showInFileUI(path),
          },
        ]
      : []
    ).concat([
      {
        title: 'Download a copy',
        onClick: () => download(path),
      },
    ]),
  }
}

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Popup'))(
  Popup
)
