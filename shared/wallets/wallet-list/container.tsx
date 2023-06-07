import {WalletList} from '.'
import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import type * as Styles from '../../styles'

type OwnProps = {
  style: Styles.StylesCrossPlatform
}

export default (ownProps: OwnProps) => {
  const accounts = Container.useSelector(state => Constants.getAccountIDs(state))
  const loading = Container.useAnyWaiting(Constants.loadAccountsWaitingKey)
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
    loading: loading,
    onAddNew: onAddNew,
    onLinkExisting: onLinkExisting,
    onWhatIsStellar: onWhatIsStellar,
    style: ownProps.style,
    title: 'Wallets',
  }
  return <WalletList {...props} />
}
