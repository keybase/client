// @flow
import {TypedConnector} from '../util/typed-connect'
import PurgeMessage from './purge-message.desktop'
import * as Constants from '../constants/pgp'

import type {Props} from './purge-message.desktop'

const connector: TypedConnector<{}, any, {}, Props> = new TypedConnector()

export default connector.connect(
  ({unlockFolders: {devices, phase, paperkeyError, waiting}}, dispatch, ownProps) => ({
    onClose: () => { dispatch({type: Constants.pgpAckedMessage, payload: {hitOk: false}}) },
    onOk: () => { dispatch({type: Constants.pgpAckedMessage, payload: {hitOk: true}}) },
  }))(PurgeMessage)

export function selector (): (store: Object) => ?Object {
  return () => ({})
}
