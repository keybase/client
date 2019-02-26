// @flow
import * as React from 'react'
import Banner, {height} from './index'
import * as FsGen from '../../../actions/fs-gen'
import * as Types from '../../../constants/types/fs'
import * as RowTypes from '../../row/types'
import {namedConnect} from '../../../util/container'
import {isMobile} from '../../../constants/platform'

type OwnProps = {|
  alwaysShow?: ?boolean,
|}

const mapStateToProps = state => ({
  driverStatus: state.fs.fileUI.driverStatus,
})

const mapDispatchToProps = dispatch => ({
  onDisable: () => dispatch(FsGen.createDriverDisable()),
  onDismiss: () => dispatch(FsGen.createHideFileUIBanner()),
  onEnable: () => dispatch(FsGen.createDriverEnable({})),
})

const ConnectedBanner = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'FileUIBanner'
)(Banner)

export default ConnectedBanner

export const asRows = isMobile
  ? (path: Types.Path, shouldShowFileUIBanner: boolean) => []
  : (path: Types.Path, shouldShowFileUIBanner: boolean): Array<RowTypes.RowItemWithKey> =>
      shouldShowFileUIBanner
        ? [
            {
              height,
              key: 'file-ui-banner',
              node: <ConnectedBanner />,
              rowType: 'header',
            },
          ]
        : []
