// @flow
import Qualify from '.'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Tabs from '../../../constants/tabs'
import * as Settings from '../../../constants/settings'
import {connect} from '../../../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onCancel: () => console.log('TODO'),
  onCheckQualify: () =>
    dispatch(
      RouteTreeGen.createNavigateTo({path: [Tabs.settingsTab, Settings.airdropTab, 'airdropQualify']})
    ),
})

const mergeProps = (s, d, o) => ({
  ...s,
  ...d,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(Qualify)
