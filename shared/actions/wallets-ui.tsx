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
      throw new Error(error.desc)
    })
}

export const validateAccountName = (params: {name: string}, dispatch) => {
  const {name} = params
  return RPCStellarGen.localValidateAccountNameLocalRpcPromise(
    {name},
    Constants.validateAccountNameWaitingKey
  )
    .then(() => dispatch(WalletsGen.createValidatedAccountName({name})))
    .catch(err => {
      dispatch(WalletsGen.createValidatedAccountNameError({error: err.desc, name}))
      throw new Error(err.desc)
    })
}
