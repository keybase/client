import EnterPaperkey from '../../../provision/paper-key'
import {createCheckPaperKey} from '../../../actions/unlock-folders-gen'
import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type OwnProps = {}

export default Container.connect(
  () => ({
    error: '',
    hint: '',
    waitingForResponse: false,
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSubmit: (paperKey: string) => {
      dispatch(createCheckPaperKey({paperKey}))
      dispatch(RouteTreeGen.createNavigateUp())
      dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(EnterPaperkey)
