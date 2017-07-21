// @flow
import Screenprotector from './screenprotector.native'
import {connect} from 'react-redux-profiled'

import type {Dispatch} from '../constants/types/flux'

export default connect(null, (dispatch: Dispatch, {navigateUp}) => ({
  title: 'Screen Protector',
  onBack: () => dispatch(navigateUp()),
}))(Screenprotector)
