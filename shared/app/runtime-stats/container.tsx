import {namedConnect, TypedState, isMobile} from '../../util/container'
import {RuntimeStatsDesktop, RuntimeStatsMobile} from '.'

const blank = {
  cpu: '???',
  goheap: '???',
  goheapsys: '???',
  gostack: '???',
  resident: '???',
  virt: '???',
}

const mapStateToProps = (state: TypedState) => {
  return state.config.runtimeStats
    ? {
        cpu: state.config.runtimeStats.cpu,
        goheap: state.config.runtimeStats.goheap,
        goheapsys: state.config.runtimeStats.goheapsys,
        gostack: state.config.runtimeStats.gostack,
        resident: state.config.runtimeStats.resident,
        virt: state.config.runtimeStats.virt,
      }
    : blank
}

export default namedConnect(mapStateToProps, () => ({}), s => ({...s}), 'RuntimeStats')(
  isMobile ? RuntimeStatsMobile : RuntimeStatsDesktop
)
