// @flow
import React from 'react'
import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'

type OwnProps = {|
  onEnabled: () => void,
|}

const mapStateToProps = state => ({
  appFocusedCount: state.config.appFocusedCount,
  driverStatus: state.fs.sfmi.driverStatus,
})

const mapDispatchToProps = dispatch => ({
  enable: () => dispatch(FsGen.createDriverEnable({isRetry: true})),
})

const mergeProps = (s, d, o) => ({
  appFocusedCount: s.appFocusedCount,
  driverStatus: s.driverStatus,
  enable: d.enable,
  onEnabled: o.onEnabled,
})

type Props = {
  appFocusedCount: number,
  driverStatus: Types.DriverStatus,
  onEnabled: () => void,
  enable: () => void,
}

class Component extends React.PureComponent<Props> {
  _initialAppFocusedCount = 0
  componentDidMount() {
    this._initialAppFocusedCount = this.props.appFocusedCount
  }
  componentDidUpdate(prevProps) {
    if (prevProps.appFocusedCount !== this.props.appFocusedCount) {
      // Somehow focus and unfocus both trigger an increment of this, so mod 2
      // to make sure it's an actual focus.
      if ((this.props.appFocusedCount - this._initialAppFocusedCount) % 2 === 0) {
        this.props.enable()
      }
    }
    if (this.props.driverStatus.type === 'enabled' && prevProps.driverStatus.type === 'disabled') {
      this.props.onEnabled()
    }
  }
  render() {
    return null
  }
}

export default namedConnect<OwnProps, _, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'TryEnableDriverOnFocus'
)(Component)
