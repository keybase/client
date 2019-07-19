import {connect, TypedState} from '../../util/container'
import RuntimeStats from '.'
import * as RPCTypes from '../../constants/types/rpc-gen'

const blank = {
  convLoaderActive: false,
  hasData: false,
  processStats: [],
  selectiveSyncActive: false,
}

const mapStateToProps = (state: TypedState) => {
  const rs = state.config.runtimeStats
  if (!rs) {
    return blank
  }
  const processStats = (rs.processStats || []).map(stats => {
    return {
      cpu: stats.cpu,
      cpuSeverity: stats.cpuSeverity,
      free: stats.free,
      goheap: stats.goheap,
      goheapsys: stats.goheapsys,
      goreleased: stats.goreleased,
      resident: stats.resident,
      residentSeverity: stats.residentSeverity,
      type: stats.type,
      virt: stats.virt,
    }
  })
  return {
    convLoaderActive: rs.convLoaderActive,
    hasData: true,
    processStats,
    selectiveSyncActive: rs.selectiveSyncActive,
  }
}

export default connect(
  mapStateToProps,
  () => ({}),
  s => ({...s})
)(RuntimeStats)
