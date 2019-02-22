// @flow
import * as React from 'react'
import Banner, {height} from './index'
import * as FsGen from '../../../actions/fs-gen'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as RowTypes from '../../row/types'
import {namedConnect, compose, lifecycle} from '../../../util/container'
import {isMobile} from '../../../constants/platform'

type OwnProps = {
  path?: Types.Path,
}

const mapStateToProps = state => ({
  dokanUninstallString: Constants.kbfsUninstallString(state),
  inProgress: state.fs.flags.fuseInstalling || state.fs.flags.kbfsInstalling || state.fs.flags.kbfsOpening,
  kbfsEnabled: Constants.kbfsEnabled(state),
  kbfsOutdated: Constants.kbfsOutdated(state),
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  _openInSystemFileManager: path && (() => dispatch(FsGen.createOpenPathInSystemFileManager({path}))),
  getFuseStatus: () => dispatch(FsGen.createFuseStatus()),
  onDismiss: () => dispatch(FsGen.createSetFlags({showBanner: false})),
  onInstall: () => dispatch(FsGen.createInstallFuse()),
  onUninstall: () => dispatch(FsGen.createUninstallKBFSConfirm()),
})

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => ({
  ...stateProps,
  dokanUninstall: stateProps.dokanUninstallString ? dispatchProps.onUninstall : undefined,
  getFuseStatus: dispatchProps.getFuseStatus,
  onDismiss: dispatchProps.onDismiss,
  onInstall: dispatchProps.onInstall,
  onUninstall: dispatchProps.onUninstall,
  openInSystemFileManager:
    stateProps.kbfsEnabled && path ? () => dispatchProps._openInSystemFileManager : undefined,
  path,
})

const ConnectedBanner = isMobile
  ? () => null
  : compose(
      namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'FileUIBanner'),
      lifecycle({
        componentDidMount() {
          this.props.getFuseStatus()
        },
      })
    )(Banner)

export default ConnectedBanner

export const asRows = (path: Types.Path, shouldShowFileUIBanner: boolean): Array<RowTypes.RowItemWithKey> =>
  shouldShowFileUIBanner
    ? [
        {
          height,
          key: 'file-ui-banner',
          node: <ConnectedBanner path={path} />,
          rowType: 'header',
        },
      ]
    : []
