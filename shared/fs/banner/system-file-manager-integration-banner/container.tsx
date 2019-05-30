import * as React from 'react'
import Banner, {height} from './index'
import * as FsGen from '../../../actions/fs-gen'
import * as Types from '../../../constants/types/fs'
import * as RowTypes from '../../browser/rows/types'
import {namedConnect} from '../../../util/container'
import {isMobile} from '../../../constants/platform'

type OwnProps = {
  alwaysShow?: boolean | null
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  driverStatus: state.fs.sfmi.driverStatus,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onDisable: () => dispatch(FsGen.createDriverDisable()),
  onDismiss: () => dispatch(FsGen.createHideSystemFileManagerIntegrationBanner()),
  onEnable: () => dispatch(FsGen.createDriverEnable({})),
})

const ConnectedBanner = namedConnect(
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
              rowType: RowTypes.RowType.Header,
            },
          ]
        : []
