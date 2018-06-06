// @flow
import * as React from 'react'
import {connect, type TypedState} from '../../util/container'
import Splash from './splash/container'
import Intro from './intro/container'

const mapStateToProps = (state: TypedState, {navigateAppend}) => ({bootStatus: state.config.bootStatus})
const mapDispatchToProps = (dispatch: Dispatch, {navigateAppend}) => ({})

const Switcher = ({bootStatus, navigateAppend}) => {
  switch (bootStatus) {
    case 'bootStatusLoading':
    case 'bootStatusFailure':
      return <Splash navigateAppend={navigateAppend} />
    default:
      return <Intro navigateAppend={navigateAppend} />
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Switcher)
