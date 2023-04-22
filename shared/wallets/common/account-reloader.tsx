import * as React from 'react'
import * as WalletsGen from '../../actions/wallets-gen'
import {Reloadable} from '../../common-adapters'
import {checkOnlineWaitingKey} from '../../constants/wallets'
import * as Container from '../../util/container'

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

export default (ownProps: OwnProps) => {
  const dispatch = Container.useDispatch()
  const onReload = () => {
    dispatch(WalletsGen.createLoadAccounts({reason: 'initial-load'}))
  }
  const props = {
    children: ownProps.children,
    onBack: ownProps.onBack,
    onReload,
  }
  return <AccountReloader {...props} />
}
