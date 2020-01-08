import * as Container from '../../../util/container'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Types from '../../../constants/types/crypto'
import {IconType} from '../../../common-adapters/icon.constants-gen'
import OperationRow from '.'

type OwnProps = {
  title: string
  isSelected: boolean
  tab: Types.CryptoSubTab
  icon: IconType
}

const mapStateToProps = (/*state: Container.TypedState*/) => ({})

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _switchOperationTab: (tab: Types.CryptoSubTab) => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [tab], replace: true}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  ...stateProps,
  icon: ownProps.icon,
  isSelected: ownProps.isSelected,
  onSelect: () => dispatchProps._switchOperationTab(ownProps.tab),
  tab: ownProps.tab,
  title: ownProps.title,
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'OperationRow'
)(OperationRow)
