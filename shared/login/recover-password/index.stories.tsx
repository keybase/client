import deviceSelector from './device-selector/index.stories'
import explainDevice from './explain-device/index.stories'
import promptReset from './prompt-reset/index.stories'

const load = () => {
  ;[deviceSelector, explainDevice, promptReset].forEach(load => load())
}

export default load
