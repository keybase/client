import * as Container from '../../util/container'
import RuntimeStats from '.'

const blank = {
  _dbStats: [],
  _processStats: [],
  convLoaderActive: false,
  hasData: false,
  selectiveSyncActive: false,
}

export default Container.connect(
  state => {
    const rs = state.config.runtimeStats
    if (!rs) {
      return blank
    }
    return {
      _dbStats: rs.dbStats,
      _processStats: rs.processStats,
      convLoaderActive: rs.convLoaderActive,
      hasData: true,
      selectiveSyncActive: rs.selectiveSyncActive,
    }
  },
  () => ({}),
  stateProps => {
    const processStats = (stateProps._processStats || []).map(stats => ({
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
    }))
    const dbStats = (stateProps._dbStats || []).map(stats => ({
      memCompaction: stats.memCompActive,
      tableCompaction: stats.tableCompActive,
      type: stats.type,
    }))
    return {
      convLoaderActive: stateProps.convLoaderActive,
      dbStats,
      hasData: stateProps.hasData,
      processStats,
      selectiveSyncActive: stateProps.selectiveSyncActive,
    }
  }
)(RuntimeStats)
