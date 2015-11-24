import * as Constants from '../constants/pinentry'
import ipc from 'ipc'

export function onSubmit (passphrase, features) {
  console.log(`Passphrase submitted: ${passphrase}`)
  console.log(features)
  let result = {passphrase: passphrase}
  for (const feature in features) {
    result[feature] = features[feature]
  }
  return dispatch => {
    ipc.send('pinentryResult', result)

    dispatch({type: Constants.onSubmit})
  }
}

export function onCancel () {
  console.log('Pinentry dialog canceled')
  return dispatch => {
    ipc.send('pinentryResult', {error: 'User canceled'})

    dispatch({type: Constants.onCancel})
  }
}
