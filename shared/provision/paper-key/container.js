// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import PaperKey from '.'
import {compose, withStateHandlers, connect, type TypedState, type Dispatch} from '../../util/container'
import HiddenString from '../../util/hidden-string'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = {paperKey: string} & RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  error: state.provision.error.stringValue(),
  hint: `${state.provision.codePageOtherDeviceName || ''}...`,
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmit: () =>
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey: new HiddenString(ownProps.paperKey)})),
})

export default compose(
  withStateHandlers({paperKey: ''}, {onChangePaperKey: () => (paperKey: string) => ({paperKey})}),
  connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))
)(PaperKey)
