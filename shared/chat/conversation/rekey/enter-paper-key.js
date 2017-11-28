// @flow
import EnterPaperkey from '../../../login/register/paper-key'
import {createCheckPaperKey} from '../../../actions/unlock-folders-gen'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'
import {compose, withState, withHandlers} from 'recompose'

const mapStateToProps = () => ({
  error: '',
  waitingForResponse: false,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
  onEnterPaperkey: (paperKey: string) => {
    dispatch(createCheckPaperKey({paperKey}))
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
