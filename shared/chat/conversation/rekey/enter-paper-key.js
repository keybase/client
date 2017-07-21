// @flow
import EnterPaperkey from '../../../login/register/paper-key'
import HiddenString from '../../../util/hidden-string'
import {checkPaperKey} from '../../../actions/unlock-folders'
import {connect} from 'react-redux-profiled'
import {navigateUp} from '../../../actions/route-tree'
import {compose, withState, withHandlers} from 'recompose'

const mapStateToProps = () => ({
  error: '',
  waitingForResponse: false,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
  onEnterPaperkey: (key: string) => {
    dispatch(checkPaperKey(new HiddenString(key)))
    dispatch(navigateUp())
    dispatch(navigateUp())
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withState('paperKey', 'onChangePaperKey'),
  withHandlers({
    onSubmit: ({paperKey, onEnterPaperkey}) => () => onEnterPaperkey(paperKey),
  })
)(EnterPaperkey)
