// @flow
import * as Container from '../../util/container'
import PaperKey from '.'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state: Container.TypedState) => ({
  paperkey: state.devices.newPaperkey.stringValue(),
})

const mapDispatchToProps = (dispatch: Container.Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onBack: dispatchProps.onBack,
  paperkey: stateProps.paperkey,
})

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(PaperKey)
