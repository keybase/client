// @flow
import PurgeMessage from './purge-message.desktop'
import {connect} from 'react-redux'
import * as Constants from '../constants/pgp'

export default connect(
  (state: any) => ({}),
  (dispatch: any) => ({
    onClose: () => {
      dispatch({type: Constants.pgpAckedMessage, payload: {hitOk: false}})
    },
    onOk: () => {
      dispatch({type: Constants.pgpAckedMessage, payload: {hitOk: true}})
    },
  })
)(PurgeMessage)

export function selector(): (store: Object) => ?Object {
  return () => ({})
}
