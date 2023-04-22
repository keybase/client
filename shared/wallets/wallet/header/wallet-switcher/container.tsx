import type * as React from 'react'
import * as Constants from '../../../../constants/wallets'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {WalletSwitcher} from '.'

type OwnProps = {
  getAttachmentRef?: () => React.Component<any> | null
  showingMenu: boolean
  hideMenu: () => void
}

export default (ownProps: OwnProps) => {
  const accounts = Container.useSelector(state => Constants.getAccountIDs(state))
  const dispatch = Container.useDispatch()
  const onAddNew = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {showOnCreation: true}, selected: 'createNewAccount'}],
      })
    )
  }
  const onLinkExisting = () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
    )
  }
  const onWhatIsStellar = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['whatIsStellarModal']}))
  }
  const props = {
    accountIDs: accounts,
    onAddNew: onAddNew,
    onLinkExisting: onLinkExisting,
    onWhatIsStellar: onWhatIsStellar,
    ...ownProps,
  }
  return <WalletSwitcher {...props} />
}
