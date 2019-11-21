import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderHoc} from '../../common-adapters'
import {compose} from 'recompose'
import Display from '.'
import {connect, TypedState} from '../../util/container'
import {DarkModePreference} from '../../styles/dark-mode'

type OwnProps = {}
const mapStateToProps = (state: TypedState) => ({
  darkModePreference: state.config.darkModePreference,
  title: 'Display',
  useNativeFrame: state.config.useNativeFrame,
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onChangeUseNativeFrame: (useNativeFrame: boolean) =>
    dispatch(ConfigGen.createSetUseNativeFrame({useNativeFrame})),
  onSetDarkModePreference: (preference: DarkModePreference) =>
    dispatch(ConfigGen.createSetDarkModePreference({preference})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, (s, d, o: OwnProps) => ({...o, ...s, ...d})),
  HeaderHoc
  // @ts-ignore
)(Display)
