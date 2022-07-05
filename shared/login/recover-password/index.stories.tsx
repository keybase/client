import deviceSelector from './device-selector/index.stories'
import error from './error/index.stories'
import explainDevice from './explain-device/index.stories'
import paperKey from './paper-key/index.stories'
import promptReset from './prompt-reset/index.stories'

const load = () => {
  ;[deviceSelector, error, explainDevice, paperKey, promptReset].forEach(load => load())
}

export default load
