// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import * as Constants from '../../constants/provision'
import PaperKey from '.'
import {compose, withStateHandlers, connect, type TypedState, type Dispatch} from '../../util/container'
import HiddenString from '../../util/hidden-string'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = {paperKey: string} & RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  error: state.provision.error.stringValue(),
  waitingForResponse: !!state.waiting.get(Constants.waitingKey),
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmit: () =>
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey: new HiddenString(ownProps.paperKey)})),
})

export default compose(
  withStateHandlers({paperKey: ''}, {onChangePaperKey: () => (paperKey: string) => ({paperKey})}),
  connect(mapStateToProps, mapDispatchToProps)
)(PaperKey)
