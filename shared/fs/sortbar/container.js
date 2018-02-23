// @flow
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import SortBar from './sortbar'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'

type OwnProps = {
  path: Types.Path,
}

type StateProps = {
  sortSetting: Types.SortSetting,
  folderIsPending: boolean,
}

type DispatchProps = {
  _getOnOpenSortSettingPopup: (path: Types.Path) => void,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => ({
  sortSetting: state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort'),
  folderIsPending: state.fs.pathItems.get(path, Constants.makeFolder()).progress === 'pending',
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _getOnOpenSortSettingPopup: (path: Types.Path) =>
    dispatch(
      navigateAppend([
        {
          props: {
            sortSettingToAction: (sortSetting: Types.SortSetting) => (evt?: SyntheticEvent<>) => {
              dispatch(FsGen.createSortSetting({path, sortSetting: Constants.makeSortSetting(sortSetting)}))
              if (evt) {
                dispatch(navigateUp())
                evt.stopPropagation()
              }
            },
            onHidden: () => dispatch(navigateUp()),
          },
          selected: 'sortbarAction',
        },
      ])
    ),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, {path}: OwnProps) => ({
  sortSetting: stateProps.sortSetting,
  folderIsPending: stateProps.folderIsPending,
  onOpenSortSettingPopup: () => dispatchProps._getOnOpenSortSettingPopup(path),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('SortBar'))(
  SortBar
)
