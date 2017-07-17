// @flow
import React, {Component} from 'react'

import Install from './install'
import Folders from './folders'
import {connect} from 'react-redux'

import type {TypedState} from '../constants/reducer'

type Props = {
  fuseInstalled: boolean,
}

class Index extends Component<void, Props, void> {
  render() {
    if (!this.props.fuseInstalled) {
      return <Install />
    }
    return <Folders />
  }
}

const mapStateToProps = (state: TypedState) => ({
  fuseInstalled: state.favorite.fuseStatus.status ? state.favorite.fuseStatus.status.kextStarted : false,
})

export default connect(mapStateToProps)(Index)
