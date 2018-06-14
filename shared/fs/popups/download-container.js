// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'
import DownloadPopup from './download'
import {formatDurationFromNowTo} from '../../util/timestamp'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const path = routeProps.get('path')
  const _pathItem = state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()
  const _username = state.config.username || undefined
  const _downloads = state.fs.downloads
  return {
    path,
    _pathItem,
    _username,
    _downloads,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onHidden: () => dispatch(navigateUp()),
  _dismissDownload: (key: string) => dispatch(FsGen.createDismissDownload({key})),
  _cancelDownload: (key: string) => dispatch(FsGen.createCancelDownload({key})),
})

const mergeProps = (stateProps, {_onHidden, _dismissDownload, _cancelDownload}) => {
  const itemStyles = Constants.getItemStyles(
    Types.getPathElements(stateProps.path),
    stateProps._pathItem.type,
    stateProps._username
  )
  const downloadKV = stateProps._downloads
    .filter(download => ['camera-roll', 'share'].includes(download.meta.intent))
    .entries()
    .next().value || ['', Constants.makeDownload()]
  const [
    key,
    {
      meta: {intent},
      state: {completePortion, endEstimate, isDone, error},
    },
  ] = downloadKV
  const onHidden = () => {
    isDone || _cancelDownload(key)
    _onHidden()
    _dismissDownload(key)
  }
  isDone && !error && onHidden()
  return {
    name: stateProps._pathItem.name,
    intent,
    itemStyles,
    completePortion,
    error,
    progressText: formatDurationFromNowTo(endEstimate),
    onHidden,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('DownloadPopup')
)(DownloadPopup)
