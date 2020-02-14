import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {isIPhoneX} from '../constants/platform'
import * as RPCTypes from '../constants/types/rpc-gen'
// @ts-ignore
import lagRadar from 'lag-radar'
import flags from '../util/feature-flags'

type Props = {
  stats: RPCTypes.RuntimeStats
}

const yesNo = (v?: boolean) => (v ? 'YES' : 'NO')

const severityStyle = (s: RPCTypes.StatsSeverityLevel) => {
  switch (s) {
    case RPCTypes.StatsSeverityLevel.normal:
      return styles.statNormal
    case RPCTypes.StatsSeverityLevel.warning:
      return styles.statWarning
    case RPCTypes.StatsSeverityLevel.severe:
      return styles.statSevere
  }
  return styles.statNormal
}

const processTypeString = (s: RPCTypes.ProcessType) => {
  switch (s) {
    case RPCTypes.ProcessType.main:
      return 'Service'
    case RPCTypes.ProcessType.kbfs:
      return 'KBFS'
  }
}

const dbTypeString = (s: RPCTypes.DbType) => {
  switch (s) {
    case RPCTypes.DbType.main:
      return 'Core'
    case RPCTypes.DbType.chat:
      return 'Chat'
    case RPCTypes.DbType.fsBlockCache:
      return 'FSBlkCache'
    case RPCTypes.DbType.fsBlockCacheMeta:
      return 'FSBlkCacheMeta'
    case RPCTypes.DbType.fsSyncBlockCache:
      return 'FSSyncBlkCache'
    case RPCTypes.DbType.fsSyncBlockCacheMeta:
      return 'FSSyncBlkCacheMeta'
  }
}

let destroyRadar: (() => void) | undefined
let radarNode: HTMLDivElement | undefined
const radarSize = 30

const makeRadar = (show: boolean) => {
  if (destroyRadar) {
    destroyRadar()
    destroyRadar = undefined
  }
  if (!radarNode || !show) {
    return
  }

  destroyRadar = lagRadar({
    frames: 5,
    inset: 1,
    parent: radarNode,
    size: radarSize,
    speed: 0.0017 * 0.7,
  })
}

const RuntimeStatsDesktop = ({stats}: Props) => {
  const [showRadar, setShowRadar] = React.useState(flags.lagRadar)
  const refContainer = React.useCallback(
    node => {
      radarNode = node
      makeRadar(showRadar)
    },
    [showRadar]
  )
  const toggleRadar = () => {
    const show = !showRadar
    setShowRadar(show)
    makeRadar(show)
  }

  return (
    <>
      <Kb.Box style={Styles.globalStyles.flexGrow} />
      <Kb.Box2 direction="vertical" style={styles.container} gap="xxtiny" fullWidth={true}>
        {stats.processStats?.map((stat, i) => {
          return (
            <Kb.Box2 direction="vertical" key={`process${i}`} fullWidth={true} noShrink={true}>
              <Kb.Text type="BodyTinyBold" style={styles.stat}>
                {processTypeString(stat.type)}
              </Kb.Text>
              <Kb.Text
                style={Styles.collapseStyles([styles.stat, severityStyle(stat.cpuSeverity)])}
                type="BodyTiny"
              >{`CPU: ${stat.cpu}`}</Kb.Text>
              <Kb.Text
                style={Styles.collapseStyles([styles.stat, severityStyle(stat.residentSeverity)])}
                type="BodyTiny"
              >{`Res: ${stat.resident}`}</Kb.Text>
              <Kb.Text style={styles.stat} type="BodyTiny">{`Virt: ${stat.virt}`}</Kb.Text>
              <Kb.Text style={styles.stat} type="BodyTiny">{`Free: ${stat.free}`}</Kb.Text>
              <Kb.Text style={styles.stat} type="BodyTiny">{`GoHeap: ${stat.goheap}`}</Kb.Text>
              <Kb.Text style={styles.stat} type="BodyTiny">{`GoHeapSys: ${stat.goheapsys}`}</Kb.Text>
              <Kb.Text style={styles.stat} type="BodyTiny">{`GoReleased: ${stat.goreleased}`}</Kb.Text>
              <Kb.Divider />
              <Kb.Divider />
            </Kb.Box2>
          )
        })}
        <Kb.Divider />
        <Kb.Text type="BodyTinyBold" style={styles.stat}>
          Chat Bkg Activity
        </Kb.Text>
        <Kb.Text
          style={Styles.collapseStyles([
            styles.stat,
            stats.convLoaderActive ? styles.statWarning : styles.statNormal,
          ])}
          type="BodyTiny"
        >{`BkgLoaderActive: ${yesNo(stats.convLoaderActive)}`}</Kb.Text>
        <Kb.Text
          style={Styles.collapseStyles([
            styles.stat,
            stats.selectiveSyncActive ? styles.statWarning : styles.statNormal,
          ])}
          type="BodyTiny"
        >{`IndexerSyncActive: ${yesNo(stats.selectiveSyncActive)}`}</Kb.Text>
        <Kb.Divider />
        <Kb.Text type="BodyTinyBold" style={styles.stat}>
          LevelDB Compaction
        </Kb.Text>
        {stats.dbStats?.map((stat, i) => {
          return (
            <Kb.Box2 direction="vertical" key={`db${i}`} fullWidth={true}>
              <Kb.Text
                type="BodyTiny"
                style={Styles.collapseStyles([
                  styles.stat,
                  stat.memCompActive || stat.tableCompActive ? styles.statWarning : styles.statNormal,
                ])}
              >
                {`${dbTypeString(stat.type)}: ${yesNo(stat.memCompActive || stat.tableCompActive)}`}
              </Kb.Text>
            </Kb.Box2>
          )
        })}
        <Kb.Box style={styles.radarContainer} forwardedRef={refContainer} onClick={toggleRadar} />
      </Kb.Box2>
    </>
  )
}

const compactionActive = (dbStats: Props['stats']['dbStats'], typs: Array<RPCTypes.DbType>) =>
  dbStats?.some(stat => typs.indexOf(stat.type) >= 0 && (stat.memCompActive || stat.tableCompActive))

const chatDbs = [RPCTypes.DbType.chat, RPCTypes.DbType.main]
const kbfsDbs = [
  RPCTypes.DbType.fsBlockCache,
  RPCTypes.DbType.fsBlockCacheMeta,
  RPCTypes.DbType.fsSyncBlockCache,
  RPCTypes.DbType.fsSyncBlockCacheMeta,
]

const RuntimeStatsMobile = ({stats}: Props) => {
  const processStat = stats.processStats?.[0]
  const coreCompaction = compactionActive(stats.dbStats, chatDbs)
  const kbfsCompaction = compactionActive(stats.dbStats, kbfsDbs)
  return (
    <Kb.Box2 direction="horizontal" style={styles.container} gap="xtiny" pointerEvents="none">
      {processStat && (
        <Kb.Box2 direction="vertical">
          <Kb.Box2 direction="horizontal" gap="xxtiny" alignSelf="flex-end">
            <Kb.Text
              style={Styles.collapseStyles([styles.stat, severityStyle(processStat.cpuSeverity)])}
              type="BodyTiny"
            >{`C:${processStat.cpu}`}</Kb.Text>
            <Kb.Text
              style={Styles.collapseStyles([styles.stat, severityStyle(processStat.residentSeverity)])}
              type="BodyTiny"
            >{`R:${processStat.resident}`}</Kb.Text>
            <Kb.Text style={styles.stat} type="BodyTiny">{`V:${processStat.virt}`}</Kb.Text>
            <Kb.Text style={styles.stat} type="BodyTiny">{`F:${processStat.free}`}</Kb.Text>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" gap="xxtiny" alignSelf="flex-end">
            <Kb.Text style={styles.stat} type="BodyTiny">{`GH:${processStat.goheap}`}</Kb.Text>
            <Kb.Text style={styles.stat} type="BodyTiny">{`GS:${processStat.goheapsys}`}</Kb.Text>
            <Kb.Text style={styles.stat} type="BodyTiny">{`GR:${processStat.goreleased}`}</Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      )}
      <Kb.Box2 direction="vertical">
        <Kb.Text
          style={Styles.collapseStyles([
            styles.stat,
            stats.convLoaderActive ? styles.statWarning : styles.statNormal,
          ])}
          type="BodyTiny"
        >{`CLA: ${yesNo(stats.convLoaderActive)}`}</Kb.Text>
        <Kb.Text
          style={Styles.collapseStyles([
            styles.stat,
            stats.selectiveSyncActive ? styles.statWarning : styles.statNormal,
          ])}
          type="BodyTiny"
        >{`SSA: ${yesNo(stats.selectiveSyncActive)}`}</Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical">
        <Kb.Text
          style={Styles.collapseStyles([
            styles.stat,
            coreCompaction ? styles.statWarning : styles.statNormal,
          ])}
          type="BodyTiny"
        >{`LC: ${yesNo(coreCompaction)}`}</Kb.Text>
        <Kb.Text
          style={Styles.collapseStyles([
            styles.stat,
            kbfsCompaction ? styles.statWarning : styles.statNormal,
          ])}
          type="BodyTiny"
        >{`LK: ${yesNo(kbfsCompaction)}`}</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const RuntimeStats = () => {
  const stats = Container.useSelector(state => state.config.runtimeStats)
  return stats ? (
    Styles.isMobile ? (
      <RuntimeStatsMobile stats={stats} />
    ) : (
      <RuntimeStatsDesktop stats={stats} />
    )
  ) : null
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.blackOrBlack},
    isElectron: {
      overflow: 'auto',
      padding: Styles.globalMargins.tiny,
      position: 'relative',
    },
    isMobile: {
      bottom: isIPhoneX ? 15 : 0,
      position: 'absolute',
      right: isIPhoneX ? 10 : 0,
    },
  }),
  radarContainer: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.white_20,
      borderRadius: '50%',
      height: radarSize,
      position: 'absolute',
      right: Styles.globalMargins.tiny,
      top: Styles.globalMargins.tiny,
      width: radarSize,
    },
  }),
  stat: Styles.platformStyles({
    common: {
      color: Styles.globalColors.whiteOrGreenDark,
    },
    isMobile: {
      fontFamily: 'Courier',
      fontSize: 10,
      lineHeight: 14,
    },
  }),
  statNormal: {
    color: Styles.globalColors.whiteOrGreenDark,
  },
  statSevere: {
    color: Styles.globalColors.red,
  },
  statWarning: {
    color: Styles.globalColors.yellowOrYellowAlt,
  },
}))

export default RuntimeStats
