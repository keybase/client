import {namedConnect, TypedState} from '../../util/container'
import RuntimeStats from '.'

const blank = {
  cpu: '???',
  resident: '???',
}

const mapStateToProps = (state: TypedState) => {
  return state.config.runtimeStats
    ? {
        cpu: state.config.runtimeStats.cpu,
        resident: state.config.runtimeStats.resident,
      }
    : blank
}

export default namedConnect(mapStateToProps, (d, o) => ({}), (s, d, o) => ({...s}), 'RuntimeStats')(
  RuntimeStats
)
