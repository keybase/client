import deviceSelector from './device-selector/index.stories'
import error from './error/index.stories'
import explainDevice from './explain-device/index.stories'
import paperKey from './paper-key/index.stories'
import promptResetAccount from './prompt-reset-account/index.stories'
import promptResetPassword from './prompt-reset-password/index.stories'

const load = () => {
  ;[deviceSelector, error, explainDevice, paperKey, promptResetAccount, promptResetPassword].forEach(load =>
    load()
  )
}

export default load
