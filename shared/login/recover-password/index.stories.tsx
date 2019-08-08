import deviceSelector from './device-selector/index.stories'

const load = () => {
  ;[deviceSelector].forEach(load => load())
}

export default load
