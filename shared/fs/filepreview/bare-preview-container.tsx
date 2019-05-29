import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {isMobile} from '../../constants/platform'
import {getRouteProps, namedConnect, RouteProps} from '../../util/container'
import BarePreview from './bare-preview'

type OwnProps = RouteProps<
  {
    path: Types.Path
  },
  {}
>

const mapDispatchToProps = (dispatch, {navigateUp}: OwnProps) => ({
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (stateProps, {onBack}, ownProps: OwnProps) => ({
  onBack,
  path: getRouteProps(ownProps, 'path') || Constants.defaultPath,
  routePath: I.List(), // TODO fix ownProps.routePath,
})

const ConnectedBarePreview = isMobile
  ? namedConnect(() => ({}), mapDispatchToProps, mergeProps, 'BarePreview')(BarePreview)
  : () => null

export default ConnectedBarePreview
