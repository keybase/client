import {namedConnect, TypedState, isMobile} from '../../util/container'
import {RuntimeStatsDesktop, RuntimeStatsMobile} from '.'
import * as RPCTypes from '../../constants/types/rpc-gen'

const blank = {
  convLoaderActive: false,
  cpu: '???',
  cpuSeverity: RPCTypes.StatsSeverityLevel.normal,
  free: '???',
  goheap: '???',
  goheapsys: '???',
  goreleased: '???',
  hasData: false,
  resident: '???',
  residentSeverity: RPCTypes.StatsSeverityLevel.normal,
  selectiveSyncActive: false,
  virt: '???',
}

const mapStateToProps = (state: TypedState) => {
  return state.config.runtimeStats
    ? {
        convLoaderActive: state.config.runtimeStats.convLoaderActive,
        cpu: state.config.runtimeStats.cpu,
        cpuSeverity: state.config.runtimeStats.cpuSeverity,
        free: state.config.runtimeStats.free,
        goheap: state.config.runtimeStats.goheap,
        goheapsys: state.config.runtimeStats.goheapsys,
        goreleased: state.config.runtimeStats.goreleased,
        hasData: true,
        resident: state.config.runtimeStats.resident,
        residentSeverity: state.config.runtimeStats.residentSeverity,
        selectiveSyncActive: state.config.runtimeStats.selectiveSyncActive,
        virt: state.config.runtimeStats.virt,
      }
    : blank
}

export default namedConnect(mapStateToProps, () => ({}), s => ({...s}), 'RuntimeStats')(
  isMobile ? RuntimeStatsMobile : RuntimeStatsDesktop
)
