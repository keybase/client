// @flow
import Screenprotector from './screenprotector'
import {connect} from 'react-redux'

import type {Dispatch} from '../constants/types/flux'

export default connect(
  null,
  (dispatch: Dispatch, {navigateUp}) => ({
    title: 'Screen Protector',
    onBack: () => dispatch(navigateUp()),
  })
)(Screenprotector)
