// @flow
import RenderSuccess from './index.render'
import {connect} from 'react-redux'
import {sawPaperKey} from '../../../actions/signup'
import {navigateUp} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'
import type {TypedDispatch} from '../../../constants/types/flux'

export default connect(
  (state: TypedState) => ({
    paperkey: state.signup.paperkey && state.signup.paperkey.stringValue('') || '',
    waiting: state.signup.waiting,
  }),
  (dispatch: TypedDispatch<*>) => ({
    onFinish: () => { dispatch(sawPaperKey()) },
    onBack: () => { dispatch(navigateUp()) },
  })
)(RenderSuccess)
