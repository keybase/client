// @flow
import EnterPaperkey from '../../../provision/paper-key'
import {createCheckPaperKey} from '../../../actions/unlock-folders-gen'
import {connect} from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = {||}

const mapStateToProps = () => ({
  error: '',
  hint: '',
  waitingForResponse: false,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSubmit: (paperKey: string) => {
    dispatch(createCheckPaperKey({paperKey}))
    dispatch(RouteTreeGen.createNavigateUp())
    dispatch(RouteTreeGen.createNavigateUp())
  },
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(EnterPaperkey)
