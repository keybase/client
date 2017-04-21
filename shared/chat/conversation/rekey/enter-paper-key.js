// @flow
import EnterPaperkey from '../../../login/register/paper-key/index.render'
import HiddenString from '../../../util/hidden-string'
import {checkPaperKey} from '../../../actions/unlock-folders'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'
import {compose, withState, withHandlers} from 'recompose'

export default compose(
  connect(
    () => ({
      error: '',
      waitingForResponse: false,
    }),
    (dispatch: Dispatch) => ({
      onBack: () => dispatch(navigateUp()),
      onEnterPaperkey: (key: string) => {
        dispatch(checkPaperKey(new HiddenString(key)))
        dispatch(navigateUp())
        dispatch(navigateUp())
      },
    })),
  withState('paperKey', 'onChangePaperKey'),
  withHandlers({
    onSubmit: ({paperKey, onEnterPaperkey}) => () => onEnterPaperkey(paperKey),
  }),
)(EnterPaperkey)
