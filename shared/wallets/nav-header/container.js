// @flow
import * as Container from '../../util/container'
import * as Constants from '../../constants/wallets'
import {HeaderTitle as _HeaderTitle} from '.'

const mapStateToPropsHeaderTitle = state => ({
  _account: Constants.getSelectedAccountData(state),
  username: state.config.username || '',
})

const mergePropsHeaderTitle = s => ({
  accountID: s._account.accountID,
  accountName: s._account.name,
  isDefault: s._account.isDefault,
  username: s.username,
})

export const HeaderTitle = Container.namedConnect<{||}, _, _, _, _>(
  mapStateToPropsHeaderTitle,
  () => ({}),
  mergePropsHeaderTitle,
  'WalletHeaderTitle'
)(_HeaderTitle)
