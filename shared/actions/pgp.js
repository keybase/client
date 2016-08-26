// @flow

import * as Constants from '../constants/pgp'
import {takeEvery} from 'redux-saga'
import {pgpPgpStorageDismissRpc} from '../constants/types/flow-types'

import type {PgpAckedMessage} from '../constants/pgp'

function pgpStorageDismiss () {
  // make rpc call to pgpStorageDismiss
  pgpPgpStorageDismissRpc({
    callback: (err) => {
      if (err) {
        console.warn(`Error in sending pgpPgpStorageDismissRpc: ${err}`)
      }
    },
  })
}

function * pgpSecurityModelChangeMessageSaga ({payload: {hitOk}}: PgpAckedMessage): any {
  if (hitOk) {
    pgpStorageDismiss()
  }
}

function * saga (): any {
  yield takeEvery(Constants.pgpAckedMessage, pgpSecurityModelChangeMessageSaga)
}

export default saga
