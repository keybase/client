import * as ConfigGen from '../../actions/config-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import Display from '.'
import {DarkModePreference} from '../../styles/dark-mode'

type OwnProps = {}
export default Container.connect(
  state => ({
    allowAnimatedEmojis: state.config.allowAnimatedEmojis,
    darkModePreference: state.config.darkModePreference,
  }),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onSetDarkModePreference: (preference: DarkModePreference) =>
      dispatch(ConfigGen.createSetDarkModePreference({preference})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(Display)
