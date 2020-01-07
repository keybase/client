import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderHoc} from '../../common-adapters'
import Display from '.'
import {connect, TypedState} from '../../util/container'
import {DarkModePreference} from '../../styles/dark-mode'

type OwnProps = {}
const mapStateToProps = (state: TypedState) => ({
  darkModePreference: state.config.darkModePreference,
  title: 'Display',
})

const mapDispatchToProps = dispatch => ({
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onSetDarkModePreference: (preference: DarkModePreference) =>
    dispatch(ConfigGen.createSetDarkModePreference({preference})),
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o: OwnProps) => ({...o, ...s, ...d}))(
  HeaderHoc(Display)
)
