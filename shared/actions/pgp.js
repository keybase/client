// @flow
import * as PgpGen from '../actions/pgp-gen'
import * as RPCTypes from '../constants/types/flow-types'
import * as Saga from '../util/saga'

function pgpStorageDismiss() {
  // make rpc call to pgpStorageDismiss
  RPCTypes.pgpPgpStorageDismissRpcPromise().catch(err => {
    console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
  })
}

function* _pgpSecurityModelChangeMessageSaga({
  payload: {hitOk},
}: PgpGen.PgpAckedMessagePayload): Generator<any, void, any> {
  pgpStorageDismiss()
}

function* pgpSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(PgpGen.pgpAckedMessage, _pgpSecurityModelChangeMessageSaga)
}

export default pgpSaga
