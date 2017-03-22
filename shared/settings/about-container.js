// @flow
import About from './about'
import {connect} from 'react-redux'
import {version} from '../constants/platform'

import type {TypedState} from '../constants/reducer'

export default connect(
  (state: TypedState) => ({}),
  (dispatch: any) => ({}),
  () => ({version})
)(About)
