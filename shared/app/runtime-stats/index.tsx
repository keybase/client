import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isIPhoneX} from '../../constants/platform'
import * as RPCTypes from '../../constants/types/rpc-gen'
import lagRadar from 'lag-radar'
import flags from '../../util/feature-flags'

type ProcessProps = {
  cpu: string
  cpuSeverity: RPCTypes.StatsSeverityLevel
  resident: string
  residentSeverity: RPCTypes.StatsSeverityLevel
  free: string
  goheap: string
  goheapsys: string
  goreleased: string
  type: RPCTypes.ProcessType
  virt: string
}

type DbProps = {
  memCompaction: boolean
  tableCompaction: boolean
  type: RPCTypes.DbType
}

type Props = {
  convLoaderActive: boolean
  dbStats: Array<DbProps>
  hasData: boolean
  processStats: Array<ProcessProps>
  selectiveSyncActive: boolean
}

const yesNo = (v: boolean) => {
  return v ? 'YES' : 'NO'
}

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

const RuntimeStatsDesktop = (props: Props) => {
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

  return !props.hasData ? null : (
    <>
      <Kb.Box style={Styles.globalStyles.flexGrow} />
      <Kb.Box2 direction="vertical" style={styles.container} gap="xxtiny" fullWidth={true}>
        {props.processStats.map((stats, i) => {
          return (
            <Kb.Box2 direction="vertical" key={`process${i}`} fullWidth={true} noShrink={true}>
              <Kb.Text type="BodyTinyBold" style={styles.stat}>
                {processTypeString(stats.type)}
              </Kb.Text>
              <Kb.Text
                style={Styles.collapseStyles([styles.stat, severityStyle(stats.cpuSeverity)])}
                type="BodyTiny"
              >{`CPU: ${stats.cpu}`}</Kb.Text>
              <Kb.Text
                style={Styles.collapseStyles([styles.stat, severityStyle(stats.residentSeverity)])}
                type="BodyTiny"
              >{`Res: ${stats.resident}`}</Kb.Text>
              <Kb.Text style={styles.stat} type="BodyTiny">{`Virt: ${stats.virt}`}</Kb.Text>
              <Kb.Text style={styles.stat} type="BodyTiny">{`Free: ${stats.free}`}</Kb.Text>
              <Kb.Text style={styles.stat} type="BodyTiny">{`GoHeap: ${stats.goheap}`}</Kb.Text>
              <Kb.Text style={styles.stat} type="BodyTiny">{`GoHeapSys: ${stats.goheapsys}`}</Kb.Text>
              <Kb.Text style={styles.stat} type="BodyTiny">{`GoReleased: ${stats.goreleased}`}</Kb.Text>
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
            props.convLoaderActive ? styles.statWarning : styles.statNormal,
          ])}
          type="BodyTiny"
        >{`BkgLoaderActive: ${yesNo(props.convLoaderActive)}`}</Kb.Text>
        <Kb.Text
          style={Styles.collapseStyles([
            styles.stat,
            props.selectiveSyncActive ? styles.statWarning : styles.statNormal,
          ])}
          type="BodyTiny"
        >{`IndexerSyncActive: ${yesNo(props.selectiveSyncActive)}`}</Kb.Text>
        <Kb.Divider />
        <Kb.Text type="BodyTinyBold" style={styles.stat}>
          LevelDB Compaction
        </Kb.Text>
        {props.dbStats.map((stats, i) => {
          return (
            <Kb.Box2 direction="vertical" key={`db${i}`} fullWidth={true}>
              <Kb.Text
                type="BodyTiny"
                style={Styles.collapseStyles([
                  styles.stat,
                  stats.memCompaction || stats.tableCompaction ? styles.statWarning : styles.statNormal,
                ])}
              >
                {`${dbTypeString(stats.type)}: ${yesNo(stats.memCompaction || stats.tableCompaction)}`}
              </Kb.Text>
            </Kb.Box2>
          )
        })}
        <Kb.Box style={styles.radarContainer} forwardedRef={refContainer} onClick={toggleRadar} />
      </Kb.Box2>
    </>
  )
}

const compactionActive = (props: Props, typs: Array<RPCTypes.DbType>) => {
  for (let i = 0; i < props.dbStats.length; i++) {
    const stats = props.dbStats[i]
    if (typs.indexOf(stats.type) >= 0 && (stats.memCompaction || stats.tableCompaction)) {
      return true
    }
  }
  return false
}

const chatDbs = [RPCTypes.DbType.chat, RPCTypes.DbType.main]
const kbfsDbs = [
  RPCTypes.DbType.fsBlockCache,
  RPCTypes.DbType.fsBlockCacheMeta,
  RPCTypes.DbType.fsSyncBlockCache,
  RPCTypes.DbType.fsSyncBlockCacheMeta,
]

const coreCompactionActive = (props: Props) => {
  return compactionActive(props, chatDbs)
}

const kbfsCompactionActive = (props: Props) => {
  return compactionActive(props, kbfsDbs)
}

const RuntimeStatsMobile = (props: Props) => {
  if (!props.hasData) {
    return null
  }
  const stats = props.processStats[0]
  const coreCompaction = coreCompactionActive(props)
  const kbfsCompaction = kbfsCompactionActive(props)
  return (
    <Kb.Box2 direction="horizontal" style={styles.container} gap="xtiny" pointerEvents="none">
      <Kb.Box2 direction="vertical">
        <Kb.Box2 direction="horizontal" gap="xxtiny" alignSelf="flex-end">
          <Kb.Text
            style={Styles.collapseStyles([styles.stat, severityStyle(stats.cpuSeverity)])}
            type="BodyTiny"
          >{`C:${stats.cpu}`}</Kb.Text>
          <Kb.Text
            style={Styles.collapseStyles([styles.stat, severityStyle(stats.residentSeverity)])}
            type="BodyTiny"
          >{`R:${stats.resident}`}</Kb.Text>
          <Kb.Text style={styles.stat} type="BodyTiny">{`V:${stats.virt}`}</Kb.Text>
          <Kb.Text style={styles.stat} type="BodyTiny">{`F:${stats.free}`}</Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="xxtiny" alignSelf="flex-end">
          <Kb.Text style={styles.stat} type="BodyTiny">{`GH:${stats.goheap}`}</Kb.Text>
          <Kb.Text style={styles.stat} type="BodyTiny">{`GS:${stats.goheapsys}`}</Kb.Text>
          <Kb.Text style={styles.stat} type="BodyTiny">{`GR:${stats.goreleased}`}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2 direction="vertical">
        <Kb.Text
          style={Styles.collapseStyles([
            styles.stat,
            props.convLoaderActive ? styles.statWarning : styles.statNormal,
          ])}
          type="BodyTiny"
        >{`CLA: ${yesNo(props.convLoaderActive)}`}</Kb.Text>
        <Kb.Text
          style={Styles.collapseStyles([
            styles.stat,
            props.selectiveSyncActive ? styles.statWarning : styles.statNormal,
          ])}
          type="BodyTiny"
        >{`SSA: ${yesNo(props.selectiveSyncActive)}`}</Kb.Text>
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

const RuntimeStats = Styles.isMobile ? RuntimeStatsMobile : RuntimeStatsDesktop

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black,
    },
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
      color: Styles.globalColors.white,
    },
    isMobile: {
      fontFamily: 'Courier',
      fontSize: 10,
      lineHeight: 14,
    },
  }),
  statNormal: {
    color: Styles.globalColors.white,
  },
  statSevere: {
    color: Styles.globalColors.red,
  },
  statWarning: {
    color: Styles.globalColors.yellow,
  },
})

export default RuntimeStats
