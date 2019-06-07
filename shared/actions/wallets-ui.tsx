import * as Constants from '../constants/wallets'
import * as Types from '../constants/types/wallets'
import * as WalletsGen from './wallets-gen'
import * as RPCStellarGen from '../constants/types/rpc-stellar-gen'

export const changeAccountName = (params: {accountID: Types.AccountID; newName: string}, dispatch) => {
  const {accountID, newName} = params
  return RPCStellarGen.localChangeWalletAccountNameLocalRpcPromise(
    {accountID, newName},
    Constants.changeAccountNameWaitingKey
  )
    .then(() => dispatch(WalletsGen.createChangedAccountName({accountID})))
    .catch(error => {
      dispatch(WalletsGen.createChangedAccountNameError({error: error.message, name: newName}))
      throw error
    })
}
