// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import {fuseStatus} from '../../actions/kbfs'
import Install from './banner-install'
import Uninstall from './banner-uninstall'

import type {TypedState} from '../../constants/reducer'

type Props = {
  fuseStatus: () => void,
  installed: boolean,
}

class Banner extends Component<void, Props, void> {
  componentDidMount() {
    this.props.fuseStatus()
  }

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

const mapDispatchToProps = (dispatch: any) => ({
  fuseStatus: () => dispatch(fuseStatus()),
})

export default connect(mapStateToProps, mapDispatchToProps)(Banner)
