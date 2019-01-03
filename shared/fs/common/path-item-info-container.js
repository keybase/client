// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import PathItemInfo from './path-item-info'

export type OwnProps = {
  path: Types.Path,
  startWithLastModified?: boolean,
  wrap?: boolean,
}

const mapStateToProps = (state, {path}) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  _tlf: Constants.getTlfFromPath(state.fs.tlfs, path),
  _username: state.config.username,
})

const mergeProps = (stateProps, dispatchProps, {path, startWithLastModified, wrap}) => {
  const resetParticipants =
    stateProps._tlf === Constants.unknownTlf
      ? undefined
      : stateProps._tlf.resetParticipants.map(i => i.username).toArray()
  return {
    isUserReset:
      resetParticipants && !!stateProps._username && resetParticipants.includes(stateProps._username),
    lastModifiedTimestamp:
      stateProps._pathItem === Constants.unknownPathItem
        ? undefined
        : stateProps._pathItem.lastModifiedTimestamp,
    lastWriter:
      stateProps._pathItem === Constants.unknownPathItem
        ? undefined
        : stateProps._pathItem.lastWriter.username,
    resetParticipants,
    startWithLastModified,
    wrap,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'PathItemInfo')(
  PathItemInfo
)
