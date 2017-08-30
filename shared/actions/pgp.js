// @flow

import * as Constants from '../constants/pgp'
import {safeTakeEvery} from '../util/saga'
import {pgpPgpStorageDismissRpcPromise} from '../constants/types/flow-types'

import type {PgpAckedMessage} from '../constants/pgp'

function pgpStorageDismiss() {
  // make rpc call to pgpStorageDismiss
  pgpPgpStorageDismissRpcPromise().catch(err => {
    console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
  })
}

function* pgpSecurityModelChangeMessageSaga({payload: {hitOk}}: PgpAckedMessage): any {
  pgpStorageDismiss()
}

function* pgpSaga(): any {
  yield safeTakeEvery(Constants.pgpAckedMessage, pgpSecurityModelChangeMessageSaga)
}

export default pgpSaga
