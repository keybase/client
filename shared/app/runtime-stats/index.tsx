import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isIPhoneX} from '../../constants/platform'
import * as RPCTypes from '../../constants/types/rpc-gen'

type Props = {
  convLoaderActive: boolean
  cpu: string
  cpuSeverity: RPCTypes.StatsSeverityLevel
  hasData: boolean
  resident: string
  residentSeverity: RPCTypes.StatsSeverityLevel
  free: string
  goheap: string
  goheapsys: string
  goreleased: string
  selectiveSyncActive: boolean
  virt: string
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

export const RuntimeStatsDesktop = (props: Props) => {
  return !props.hasData ? null : (
    <Kb.Box2 direction="vertical" style={styles.container} gap="xxtiny">
      <Kb.Text
        style={Styles.collapseStyles([styles.stat, severityStyle(props.cpuSeverity)])}
        type="BodyTiny"
      >{`CPU: ${props.cpu}`}</Kb.Text>
      <Kb.Text
        style={Styles.collapseStyles([styles.stat, severityStyle(props.residentSeverity)])}
        type="BodyTiny"
      >{`Res: ${props.resident}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`Virt: ${props.virt}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`Free: ${props.free}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`GoHeap: ${props.goheap}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`GoHeapSys: ${props.goheapsys}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`GoReleased: ${props.goreleased}`}</Kb.Text>
      <Kb.Divider />
      <Kb.Divider />
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
    </Kb.Box2>
  )
}

export const RuntimeStatsMobile = (props: Props) => {
  return !props.hasData ? null : (
    <Kb.Box2 direction="horizontal" style={styles.container} gap="tiny">
      <Kb.Box2 direction="vertical">
        <Kb.Box2 direction="horizontal" gap="xxtiny" alignSelf="flex-end">
          <Kb.Text
            style={Styles.collapseStyles([styles.stat, severityStyle(props.cpuSeverity)])}
            type="BodyTiny"
          >{`C:${props.cpu}`}</Kb.Text>
          <Kb.Text
            style={Styles.collapseStyles([styles.stat, severityStyle(props.residentSeverity)])}
            type="BodyTiny"
          >{`R:${props.resident}`}</Kb.Text>
          <Kb.Text style={styles.stat} type="BodyTiny">{`V:${props.virt}`}</Kb.Text>
          <Kb.Text style={styles.stat} type="BodyTiny">{`F:${props.free}`}</Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="xxtiny" alignSelf="flex-end">
          <Kb.Text style={styles.stat} type="BodyTiny">{`GH:${props.goheap}`}</Kb.Text>
          <Kb.Text style={styles.stat} type="BodyTiny">{`GS:${props.goheapsys}`}</Kb.Text>
          <Kb.Text style={styles.stat} type="BodyTiny">{`GR:${props.goreleased}`}</Kb.Text>
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
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black,
    },
    isElectron: {
      padding: Styles.globalMargins.xtiny,
    },
    isMobile: {
      bottom: isIPhoneX ? 15 : 0,
      position: 'absolute',
      right: isIPhoneX ? 10 : 0,
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
