// @flow
import SettingsPopup from '.'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps) => ({})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  // $FlowIssue we aren't passing any props yet!
  setDisplayName('SettingsPopup')
)(SettingsPopup)
