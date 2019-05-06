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
  driverStatus: state.fs.sfmi.driverStatus,
})

const mapDispatchToProps = dispatch => ({
  onDisable: () => dispatch(FsGen.createDriverDisable()),
  onDismiss: () => dispatch(FsGen.createHideSystemFileManagerIntegrationBanner()),
  onEnable: () => dispatch(FsGen.createDriverEnable({})),
})

const ConnectedBanner = namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'SystemFileManagerIntegrationBanner'
)(Banner)

export default ConnectedBanner

export const asRows = isMobile
  ? (path: Types.Path, showBanner: boolean) => []
  : (path: Types.Path, showBanner: boolean): Array<RowTypes.HeaderRowItem> =>
      showBanner
        ? [
            {
              height,
              key: 'file-ui-banner',
              node: <ConnectedBanner />,
              rowType: 'header',
            },
          ]
        : []
