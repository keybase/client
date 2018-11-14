// @flow
import EnterPaperkey from '../../../provision/paper-key'
import {createCheckPaperKey} from '../../../actions/unlock-folders-gen'
import {connect} from '../../../util/container'
import {navigateUp} from '../../../actions/route-tree'

type OwnProps = {||}

const mapStateToProps = () => ({
  error: '',
  hint: '',
  waitingForResponse: false,
})

const mapDispatchToProps = dispatch => ({
  onSubmit: (paperKey: string) => {
    dispatch(createCheckPaperKey({paperKey}))
    dispatch(navigateUp())
    dispatch(navigateUp())
  },
  onBack: () => dispatch(navigateUp()),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(EnterPaperkey)
