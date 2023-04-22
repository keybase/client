import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/provision'
import * as Container from '../../util/container'
import HiddenString from '../../util/hidden-string'
import PaperKey from '.'

export default () => {
  const error = Container.useSelector(state => state.provision.error.stringValue())
  const hint = Container.useSelector(state => `${state.provision.codePageOtherDevice.name || ''}...`)
  const waiting = Container.useSelector(state => Container.anyWaiting(state, Constants.waitingKey))

  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onSubmit = (paperkey: string) => {
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey: new HiddenString(paperkey)}))
  }
  const props = {
    error: error,
    hint: hint,
    onBack: onBack,
    onSubmit: (paperkey: string) => !waiting && onSubmit(paperkey),
    waiting: waiting,
  }
  return <PaperKey {...props} />
}
