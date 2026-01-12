import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useConfigState} from '@/stores/config'

const isIPhoneX = false as boolean
// import lagRadar from 'lag-radar'

type Props = {
  stats: T.RPCGen.RuntimeStats
}

const yesNo = (v?: boolean) => (v ? 'YES' : 'NO')

const severityStyle = (s: T.RPCGen.StatsSeverityLevel) => {
  switch (s) {
    case T.RPCGen.StatsSeverityLevel.warning:
      return styles.statWarning
    case T.RPCGen.StatsSeverityLevel.severe:
      return styles.statSevere
    default:
      return styles.statNormal
  }
}

const processTypeString = (s: T.RPCGen.ProcessType) => {
  switch (s) {
    case T.RPCGen.ProcessType.main:
      return 'Service'
    case T.RPCGen.ProcessType.kbfs:
      return 'KBFS'
    default:
      return ''
  }
}

const dbTypeString = (s: T.RPCGen.DbType) => {
  switch (s) {
    case T.RPCGen.DbType.main:
      return 'Core'
    case T.RPCGen.DbType.chat:
      return 'Chat'
    case T.RPCGen.DbType.fsBlockCache:
      return 'FSBlkCache'
    case T.RPCGen.DbType.fsBlockCacheMeta:
      return 'FSBlkCacheMeta'
    case T.RPCGen.DbType.fsSyncBlockCache:
      return 'FSSyncBlkCache'
    case T.RPCGen.DbType.fsSyncBlockCacheMeta:
      return 'FSSyncBlkCacheMeta'
    default:
      return ''
  }
}

// let destroyRadar: (() => void) | undefined
// let radarNode: HTMLDivElement | undefined
// const radarSize = 30

// const makeRadar = (show: boolean) => {
//   if (destroyRadar) {
//     destroyRadar()
//     destroyRadar = undefined
//   }
//   if (!radarNode || !show) {
//     return
//   }

//   destroyRadar = lagRadar({
//     frames: 5,
//     inset: 1,
//     parent: radarNode,
//     size: radarSize,
//     speed: 0.0017 * 0.7,
//   })
// }

// simple bucketing of incoming log lines, we have a queue of incoming items, we bucket them
// and choose a max to show. We use refs a lot since we only want to figure stuff out based on an interval
// TODO mobile
const LogStats = (props: {num?: number}) => {
  const {num} = props
  const maxBuckets = num ?? 5

  const [buckets, setBuckets] = React.useState<
    Array<{count: number; label: string; labelFull: string; updated: boolean}>
  >([])
  const [, setDoRender] = React.useState(0)
  const events = useConfigState(s => s.runtimeStats?.perfEvents)
  const lastEventsRef = React.useRef(new WeakSet<ReadonlyArray<T.RPCGen.PerfEvent>>())

  const eventsRef = React.useRef<Array<T.RPCGen.PerfEvent>>([])
  React.useEffect(() => {
    if (events) {
      // only if unprocessed
      if (!lastEventsRef.current.has(events)) {
        lastEventsRef.current.add(events)
        eventsRef.current.push(...events)
      }
    }
  }, [events])

  Kb.useInterval(() => {
    const events = eventsRef.current
    eventsRef.current = []
    const incoming = events.map(e => {
      const parts = e.message.split(' ')
      if (parts.length >= 2) {
        const [prefix, body] = parts
        const bodyParts = body?.split('.') ?? []
        const b = bodyParts.length > 1 ? bodyParts.slice(-2).join('.') : bodyParts[0]
        switch (prefix) {
          case 'GET':
            return `<w:${b}`
          case 'POST':
            return `>w:${b}`
          case 'CallCompressed':
            return `cc:${b}`
          case 'FullCachingSource:':
            return `fcs:${b}`
          case 'Call':
            return `c:${b}`
          default:
            return e.message
        }
      } else {
        return e.message
      }
    })

    // copy existing buckets
    let newBuckets = buckets.map(b => ({...b, updated: false}))

    // find existing or add new ones
    incoming.forEach((i, idx) => {
      const existing = newBuckets.find(b => b.label === i)
      const labelFull = events[idx]?.message ?? i
      if (existing) {
        existing.updated = true
        existing.count++
        existing.labelFull += '\n' + labelFull
      } else {
        newBuckets.push({count: 1, label: i, labelFull, updated: true})
      }
    })

    // sort to remove unupdated or small ones
    newBuckets = newBuckets.sort((a, b) => {
      if (a.updated !== b.updated) {
        return a.updated ? -1 : 1
      }

      return b.count - a.count
    })

    // clamp buckets
    newBuckets = newBuckets.slice(0, maxBuckets)

    // if no new ones, lets eliminate the last item
    if (!incoming.length) {
      newBuckets = newBuckets.reverse()
      newBuckets.some(b => {
        if (b.label) {
          b.label = ''
          b.count = 0
          return true
        }
        return false
      })
      newBuckets = newBuckets.reverse()
    }

    // sort remainder by alpha so things don't move around a lot
    newBuckets = newBuckets.sort((a, b) => a.label.localeCompare(b.label))

    setBuckets(newBuckets)
    setDoRender(r => r + 1)
  }, 2000)

  return (
    <Kb.Box2
      direction="vertical"
      style={{
        backgroundColor: 'rgba(0,0,0, 0.3)',
        minHeight: (Kb.Styles.isMobile ? 12 : 20) * maxBuckets,
      }}
      fullWidth={true}
    >
      {!Kb.Styles.isMobile && (
        <Kb.Text type="BodyTinyBold" style={styles.stat}>
          Logs
        </Kb.Text>
      )}
      {buckets.map((b, i) => (
        <Kb.Text
          key={i}
          type={b.updated ? 'BodyTinyBold' : 'BodyTiny'}
          style={styles.logStat}
          lineClamp={1}
          title={b.labelFull}
        >
          {b.label && b.count > 1 ? b.count : ''} {b.label}
        </Kb.Text>
      ))}
    </Kb.Box2>
  )
}

const RuntimeStatsDesktop = ({stats}: Props) => {
  // const [showRadar, setShowRadar] = React.useState(false)
  // const refContainer = React.useCallback(
  //   node => {
  //     radarNode = node
  //     makeRadar(showRadar)
  //   },
  //   [showRadar]
  // )
  // const toggleRadar = () => {
  //   const show = !showRadar
  //   setShowRadar(show)
  //   makeRadar(show)
  // }

  const [moreLogs, setMoreLogs] = React.useState(false)

  return (
    <>
      <Kb.BoxGrow style={styles.boxGrow}>
        <Kb.ClickableBox onClick={() => setMoreLogs(m => !m)}>
          <Kb.Box2 direction="vertical" style={styles.container} gap="xxtiny" fullWidth={true}>
            {!moreLogs &&
              stats.processStats?.map((stat, i) => {
                return (
                  <Kb.Box2 direction="vertical" key={`process${i}`} fullWidth={true} noShrink={true}>
                    <Kb.Text type="BodyTinyBold" style={styles.stat}>
                      {processTypeString(stat.type)}
                    </Kb.Text>
                    <Kb.Text
                      style={Kb.Styles.collapseStyles([styles.stat, severityStyle(stat.cpuSeverity)])}
                      type="BodyTiny"
                    >{`CPU: ${stat.cpu}`}</Kb.Text>
                    <Kb.Text
                      style={Kb.Styles.collapseStyles([styles.stat, severityStyle(stat.residentSeverity)])}
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
            {!moreLogs && <Kb.Divider />}
            {!moreLogs && (
              <Kb.Text type="BodyTinyBold" style={styles.stat}>
                Chat Bkg Activity
              </Kb.Text>
            )}
            {!moreLogs && (
              <Kb.Text
                style={Kb.Styles.collapseStyles([
                  styles.stat,
                  stats.convLoaderActive ? styles.statWarning : styles.statNormal,
                ])}
                type="BodyTiny"
              >{`BkgLoaderActive: ${yesNo(stats.convLoaderActive)}`}</Kb.Text>
            )}
            {!moreLogs && (
              <Kb.Text
                style={Kb.Styles.collapseStyles([
                  styles.stat,
                  stats.selectiveSyncActive ? styles.statWarning : styles.statNormal,
                ])}
                type="BodyTiny"
              >{`IndexerSyncActive: ${yesNo(stats.selectiveSyncActive)}`}</Kb.Text>
            )}
            {!moreLogs && <Kb.Divider />}
            {!moreLogs && (
              <Kb.Text type="BodyTinyBold" style={styles.stat}>
                LevelDB Compaction
              </Kb.Text>
            )}
            {!moreLogs &&
              stats.dbStats?.map((stat, i) => {
                return (
                  <Kb.Box2 direction="vertical" key={`db${i}`} fullWidth={true}>
                    <Kb.Text
                      type="BodyTiny"
                      style={Kb.Styles.collapseStyles([
                        styles.stat,
                        stat.memCompActive || stat.tableCompActive ? styles.statWarning : styles.statNormal,
                      ])}
                    >
                      {`${dbTypeString(stat.type)}: ${yesNo(stat.memCompActive || stat.tableCompActive)}`}
                    </Kb.Text>
                  </Kb.Box2>
                )
              })}
            {/*!moreLogs && (
              <Kb.Box style={styles.radarContainer} forwardedRef={refContainer} onClick={toggleRadar} />
            )*/}
            <LogStats num={moreLogs ? 25 : 5} />
          </Kb.Box2>
        </Kb.ClickableBox>
      </Kb.BoxGrow>
    </>
  )
}

const compactionActive = (dbStats: Props['stats']['dbStats'], typs: Array<T.RPCGen.DbType>) =>
  dbStats?.some(stat => typs.includes(stat.type) && (stat.memCompActive || stat.tableCompActive))

const chatDbs = [T.RPCGen.DbType.chat, T.RPCGen.DbType.main]
const kbfsDbs = [
  T.RPCGen.DbType.fsBlockCache,
  T.RPCGen.DbType.fsBlockCacheMeta,
  T.RPCGen.DbType.fsSyncBlockCache,
  T.RPCGen.DbType.fsSyncBlockCacheMeta,
]

const RuntimeStatsMobile = ({stats}: Props) => {
  const [showLogs, setShowLogs] = React.useState(true)
  const processStat = stats.processStats?.[0]
  const coreCompaction = compactionActive(stats.dbStats, chatDbs)
  const kbfsCompaction = compactionActive(stats.dbStats, kbfsDbs)
  return (
    <>
      <Kb.Box2
        direction="vertical"
        style={showLogs ? styles.modalLogStats : styles.modalLogStatsHidden}
        gap="xtiny"
      >
        <Kb.ClickableBox onClick={() => setShowLogs(s => !s)}>
          <LogStats />
        </Kb.ClickableBox>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" style={styles.container} gap="xtiny" pointerEvents="none">
        {processStat && (
          <Kb.Box2 direction="vertical">
            <Kb.Box2 direction="horizontal" gap="xxtiny" alignSelf="flex-end">
              <Kb.Text
                style={Kb.Styles.collapseStyles([styles.stat, severityStyle(processStat.cpuSeverity)])}
                type="BodyTiny"
              >{`C:${processStat.cpu}`}</Kb.Text>
              <Kb.Text
                style={Kb.Styles.collapseStyles([styles.stat, severityStyle(processStat.residentSeverity)])}
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
            style={Kb.Styles.collapseStyles([
              styles.stat,
              stats.convLoaderActive ? styles.statWarning : styles.statNormal,
            ])}
            type="BodyTiny"
          >{`CLA: ${yesNo(stats.convLoaderActive)}`}</Kb.Text>
          <Kb.Text
            style={Kb.Styles.collapseStyles([
              styles.stat,
              stats.selectiveSyncActive ? styles.statWarning : styles.statNormal,
            ])}
            type="BodyTiny"
          >{`SSA: ${yesNo(stats.selectiveSyncActive)}`}</Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="vertical">
          <Kb.Text
            style={Kb.Styles.collapseStyles([
              styles.stat,
              coreCompaction ? styles.statWarning : styles.statNormal,
            ])}
            type="BodyTiny"
          >{`LC: ${yesNo(coreCompaction)}`}</Kb.Text>
          <Kb.Text
            style={Kb.Styles.collapseStyles([
              styles.stat,
              kbfsCompaction ? styles.statWarning : styles.statNormal,
            ])}
            type="BodyTiny"
          >{`LK: ${yesNo(kbfsCompaction)}`}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

const RuntimeStats = () => {
  const stats = useConfigState(s => s.runtimeStats)
  return stats ? (
    Kb.Styles.isMobile ? (
      <RuntimeStatsMobile stats={stats} />
    ) : (
      <RuntimeStatsDesktop stats={stats} />
    )
  ) : null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      boxGrow: Kb.Styles.platformStyles({
        isElectron: {
          overflow: 'auto',
        },
      }),
      container: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.blackOrBlack},
        isElectron: {
          overflow: 'auto',
          padding: Kb.Styles.globalMargins.tiny,
          position: 'relative',
        },
        isMobile: {
          bottom: isIPhoneX ? 15 : 0,
          position: 'absolute',
          right: isIPhoneX ? 10 : 0,
        },
      }),
      logStat: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.whiteOrWhite},
        isElectron: {wordBreak: 'break-all'},
        isMobile: {
          fontFamily: 'Courier',
          fontSize: 12,
          lineHeight: 16,
        },
      }),
      modalLogStats: {
        position: 'absolute',
        right: 0,
        top: 20,
        width: 130,
      },
      modalLogStatsHidden: {
        backgroundColor: 'yellow',
        position: 'absolute',
        right: 0,
        top: 20,
        width: 20,
      },
      // radarContainer: Kb.Styles.platformStyles({
      //   isElectron: {
      //     backgroundColor: Kb.Styles.globalColors.white_20,
      //     borderRadius: '50%',
      //     height: radarSize,
      //     position: 'absolute',
      //     right: Kb.Styles.globalMargins.tiny,
      //     top: Kb.Styles.globalMargins.tiny,
      //     width: radarSize,
      //   },
      // }),
      stat: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.whiteOrGreenDark},
        isElectron: {wordBreak: 'break-all'},
        isMobile: {
          fontFamily: 'Courier',
          fontSize: 10,
          lineHeight: 14,
        },
      }),
      statNormal: {
        color: Kb.Styles.globalColors.whiteOrGreenDark,
      },
      statSevere: {
        color: Kb.Styles.globalColors.red,
      },
      statWarning: {
        color: Kb.Styles.globalColors.yellowOrYellowAlt,
      },
    }) as const
)

export default RuntimeStats
