import * as Constants from '../constants/pinentry'

export function onSubmit (passphrase, features) {
  console.log(`Passphrase submitted: ${passphrase}`)
  console.log(features)
  let result = {passphrase: passphrase}
  for (const feature in features) {
    result[feature] = features[feature]
  }
  return dispatch => {
    // TODO: send result to someone who's listening
    dispatch({type: Constants.onSubmit})
  }
}

export function onCancel () {
  console.log('Pinentry dialog canceled')
  return dispatch => {
    // TODO: send result to someone who's listening
    dispatch({type: Constants.onCancel})
  }
}
