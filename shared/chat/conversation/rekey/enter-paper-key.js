// @flow
import EnterPaperkey from '../../../login/register/paper-key'
import {createCheckPaperKey} from '../../../actions/unlock-folders-gen'
import {connect, compose, withStateHandlers} from '../../../util/container'
import {navigateUp} from '../../../actions/route-tree'

const mapStateToProps = () => ({
  error: '',
  waitingForResponse: false,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onEnterPaperkey: (paperKey: string) => {
    dispatch(createCheckPaperKey({paperKey}))
    dispatch(navigateUp())
    dispatch(navigateUp())
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withStateHandlers(
    {paperKey: null},
    {
      onChangePaperKey: () => paperKey => ({paperKey}),
      onSubmit: (_, {paperKey, _onEnterPaperkey}) => () => {
        _onEnterPaperkey(paperKey)
      },
    }
  )
)(EnterPaperkey)
