// @flow
import {compose, renderComponent, branch} from 'recompose'
import {connect} from 'react-redux'
import Install from './banner-install'
import Uninstall from './banner-uninstall'

import type {TypedState} from '../../constants/reducer'

const mapStateToProps = (state: TypedState) => {
  const installed = state.favorite.fuseStatus && state.favorite.fuseStatus.kextStarted
  return {
    installed,
  }
}

export default compose(
  connect(mapStateToProps),
  branch(props => props.installed, renderComponent(Uninstall))
)(Install)
