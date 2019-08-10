import deviceSelector from './device-selector/index.stories'
import explainDevice from './explain-device/index.stories'

const load = () => {
  ;[deviceSelector, explainDevice].forEach(load => load())
}

export default load
