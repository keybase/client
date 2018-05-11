// @flow
import {type Dispatch} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import {isMobile} from '../../constants/platform'

export const mapDispatchToShowInFileUI = (dispatch: Dispatch) => (path: Types.Path) =>
  dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)}))

export const mapDispatchToShare = (dispatch: Dispatch) => (path: Types.Path) =>
  dispatch(
    navigateAppend([
      {
        props: {path, isShare: true},
        selected: 'pathItemAction',
      },
    ])
  )

export const mapDispatchToSave = (dispatch: Dispatch) => (path: Types.Path) => {
  dispatch(FsGen.createDownload({path, intent: 'camera-roll'}))
  dispatch(
    navigateAppend([
      {
        props: {path, isShare: true},
        selected: 'transferPopup',
      },
    ])
  )
}

export const mapDispatchToOnAction = (dispatch: Dispatch) => (
  path: Types.Path,
  type: Types.PathType,
  evt?: SyntheticEvent<>
) => {
  // We may not have the folder loaded yet, but will need metadata to know
  // folder entry types in the popup. So dispatch an action now to load it.
  type === 'folder' && dispatch(FsGen.createFolderListLoad({path}))
  dispatch(
    navigateAppend([
      {
        props: {
          path,
          position: 'bottom right',
          isShare: false,
          targetRect: isMobile
            ? undefined
            : evt
              ? (evt.target: window.HTMLElement).getBoundingClientRect()
              : null,
        },
        selected: 'pathItemAction',
      },
    ])
  )
}

export const mapDispatchToOpenFinderPopup = isMobile
  ? (dispatch: Dispatch) => (evt?: SyntheticEvent<>) => undefined
  : (dispatch: Dispatch) => (evt?: SyntheticEvent<>) =>
      dispatch(
        navigateAppend([
          {
            props: {
              targetRect: evt ? (evt.target: window.HTMLElement).getBoundingClientRect() : null,
              position: 'bottom right',
              onHidden: () => dispatch(navigateUp()),
              onInstall: () => dispatch(FsGen.createInstallFuse()),
            },
            selected: 'finderAction',
          },
        ])
      )
