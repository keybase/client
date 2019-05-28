import * as React from 'react'
import * as WalletsGen from '../../actions/wallets-gen'
import {Reloadable} from '../../common-adapters'
import {checkOnlineWaitingKey} from '../../constants/wallets'
import {namedConnect} from '../../util/container'

type OwnProps = {
  children: React.ReactNode
  onBack?: () => void
}

type Props = {
  children: React.ReactNode
  onBack?: () => void
  onReload: () => void
}

const AccountReloader = (props: Props) => (
  <Reloadable
    onBack={props.onBack}
    waitingKeys={checkOnlineWaitingKey}
    onReload={props.onReload}
    reloadOnMount={true}
  >
    {props.children}
  </Reloadable>
)

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  onReload: () => dispatch(WalletsGen.createLoadAccounts({reason: 'initial-load'})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  children: ownProps.children,
  onBack: ownProps.onBack,
  onReload: dispatchProps.onReload,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'AccountReloader')(
  AccountReloader
)
