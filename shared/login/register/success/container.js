// @flow
import * as Creators from '../../../actions/login/creators'
import HiddenString from '../../../util/hidden-string'
import RenderSuccess from '../../signup/success/index.render'
import {connect, type TypedState} from '../../../util/container'

type OwnProps = {
  routeProps: {
    paperkey: HiddenString,
    title: string,
    waiting: boolean,
  },
}

const mapStateToProps = (s: TypedState, {routeProps: {paperkey, title, waiting}}: OwnProps) => ({
  paperkey,
  title,
  waiting,
})

const mapDispatchToProps = dispatch => ({
  onFinish: () => dispatch(Creators.onFinish()),
  onBack: () => dispatch(Creators.onBack()),
})

export default connect(mapStateToProps, mapDispatchToProps)(RenderSuccess)
