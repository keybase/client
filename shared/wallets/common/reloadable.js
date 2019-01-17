// @flow
import * as React from 'react'
import * as WalletsGen from '../../actions/wallets-gen'
import {Reloadable as CommonReloadable} from '../../common-adapters'
import {checkOnlineWaitingKey} from '../../constants/wallets'
import {namedConnect} from '../../util/container'

type OwnProps = {|
  children: React.Node,
|}

type Props = {|
  children: React.Node,
  onReload: () => void,
|}

const Reloadable = (props: Props) => (
  <CommonReloadable waitingKeys={checkOnlineWaitingKey} onReload={props.onReload} reloadOnMount={true}>
    {props.children}
  </CommonReloadable>
)

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  onReload: () => dispatch(WalletsGen.createLoadAccounts({reason: 'initial-load'})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  children: ownProps.children,
  onReload: dispatchProps.onReload,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Reloadable'
)(Reloadable)
