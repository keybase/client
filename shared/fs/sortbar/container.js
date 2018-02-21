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
}

type DispatchProps = {
  _getOnOpenSortSettingPopup: (path: Types.Path) => () => void,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => ({
  sortSetting: state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort'),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _getOnOpenSortSettingPopup: (path: Types.Path) => (targetRect: ?ClientRect) =>
    dispatch(
      navigateAppend([
        {
          props: {
            targetRect,
            sortSettingToAction: (sortSetting: Types.SortSetting) => () => {
              dispatch(FsGen.createSortSetting({path, sortSetting: Constants.makeSortSetting(sortSetting)}))
              dispatch(navigateUp())
            },
          },
          selected: 'sortbarAction',
        },
      ])
    ),
})

const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps, {path}: OwnProps) => ({
  sortSetting: stateProps.sortSetting,
  onOpenSortSettingPopup: dispatchProps._getOnOpenSortSettingPopup(path),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('SortBar'))(
  SortBar
)
