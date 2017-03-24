// @flow
import About from './about'
import {HeaderHoc} from '../common-adapters'
import {connect} from 'react-redux'
import {version} from '../constants/platform'
import {defaultProps, compose} from 'recompose'

import type {Dispatch} from '../constants/types/flux'

const connectedHeaderHoc = compose(
  connect(
    null,
    (dispatch: Dispatch, {navigateUp}) => ({
      title: 'About',
      onBack: () => dispatch(navigateUp()),
    })
  ),
  HeaderHoc,
  defaultProps({version})
)(About)

export default connectedHeaderHoc
