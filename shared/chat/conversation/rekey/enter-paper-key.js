// @flow
import EnterPaperkey from '../../../provision/paper-key'
import {createCheckPaperKey} from '../../../actions/unlock-folders-gen'
import {connect, compose, withStateHandlers} from '../../../util/container'
import {navigateUp} from '../../../actions/route-tree'

type OwnProps = {||}

const mapStateToProps = () => ({
  error: '',
  hint: '',
  waitingForResponse: false,
})

const mapDispatchToProps = dispatch => ({
  _onEnterPaperkey: (paperKey: string) => {
    dispatch(createCheckPaperKey({paperKey}))
    dispatch(navigateUp())
    dispatch(navigateUp())
  },
  onBack: () => dispatch(navigateUp()),
})

export default compose(
  // $FlowIssue recompose confuses flow into thinking paperKey doesn't exist
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o) => ({...o, ...s, ...d})
  ),
  withStateHandlers(
    {paperKey: ''},
    {
      onChangePaperKey: () => paperKey => ({paperKey}),
      onSubmit: (_, {paperKey, _onEnterPaperkey}) => () => {
        _onEnterPaperkey(paperKey)
      },
    }
  )
)(EnterPaperkey)
