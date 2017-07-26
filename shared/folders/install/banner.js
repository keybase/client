// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Install from './banner-install'
import Uninstall from './banner-uninstall'

import type {TypedState} from '../../constants/reducer'

type Props = {
  installed: boolean,
}

class Banner extends Component<void, Props, void> {
  render() {
    if (this.props.installed) {
      return <Uninstall />
    }
    return <Install />
  }
}

const mapStateToProps = (state: TypedState) => {
  const installed = state.favorite.fuseStatus && state.favorite.fuseStatus.kextStarted
  return {
    installed,
  }
}

export default connect(mapStateToProps)(Banner)
