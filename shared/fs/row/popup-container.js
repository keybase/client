// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FSGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import Popup from './popup'
import {fileUIName} from '../../constants/platform.desktop'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const path = routeProps.get('path')

  return {
    path,
    fileUIEnabled: state.favorite.fuseStatus ? state.favorite.fuseStatus.kextStarted : false,
    pathItem: state.fs.pathItems.get(path),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  showInFileUI: (path: Types.Path) => dispatch(FSGen.createOpenInFileUI({path: Types.pathToString(path)})),
  download: (path: Types.Path) => dispatch(FSGen.createDownload({path})),
})

const mergeProps = ({path, pathItem, fileUIEnabled}, {showInFileUI, download}, {routeProps}) => {
  const elems = Types.getPathElements(path)
  const type = pathItem ? pathItem.type : 'unknown'
  return {
    type,
    lastModifiedTimestamp: pathItem.lastModifiedTimestamp,
    lastWriter: pathItem.lastWriter,
    name: elems.pop(),
    size: pathItem.size,
    itemStyles: Constants.getItemStyles(elems, type),
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
