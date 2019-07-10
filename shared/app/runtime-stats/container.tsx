import {connect, TypedState} from '../../util/container'
import RuntimeStats from '.'
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
  const rs = state.config.runtimeStats
  return rs
    ? {
        convLoaderActive: rs.convLoaderActive,
        cpu: rs.cpu,
        cpuSeverity: rs.cpuSeverity,
        free: rs.free,
        goheap: rs.goheap,
        goheapsys: rs.goheapsys,
        goreleased: rs.goreleased,
        hasData: true,
        resident: rs.resident,
        residentSeverity: rs.residentSeverity,
        selectiveSyncActive: rs.selectiveSyncActive,
        virt: rs.virt,
      }
    : blank
}

export default connect(
  mapStateToProps,
  () => ({}),
  s => ({...s})
)(RuntimeStats)
