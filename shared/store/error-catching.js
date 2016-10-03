import {globalError} from '../constants/config'

const errorCatching = store => next => action => {
  try {
    return next(action)
  } catch (error) {
    console.error(`Caught a middleware exception ${error}`)

    return next({
      type: globalError,
      payload: errorToPayload(error),
    })
  }
}

const errorToPayload = (error: any): {summary: ?string, details: ?string} => {
  let summary
  let details

  if (error.hasOwnProperty('desc') && error.hasOwnProperty('code')) {
    summary = `Rpc error: ${error.desc}`
    details = `Code: ${error.code}`
  } else {
    if (error.message && error.message.length < 50) {
      summary = `Throw error: ${error.message}`
      details = error.stack
    } else {
      summary = `Throw error: ${error.name}`
      details = `${error.message}. ${error.stack}`
    }
  }

  return {summary, details}
}

export default errorCatching
export {
  errorToPayload,
}
