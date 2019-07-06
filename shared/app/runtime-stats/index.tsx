import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {isIPhoneX} from '../../constants/platform'

type Props = {
  cpu: string
  resident: string
  goheap: string
  goheapsys: string
  goreleased: string
  virt: string
}

export const RuntimeStatsDesktop = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" style={styles.container} gap="xxtiny">
      <Kb.Text style={styles.stat} type="BodyTiny">{`CPU: ${props.cpu}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`Res: ${props.resident}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`Virt: ${props.virt}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`GoHeap: ${props.goheap}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`GoHeapSys: ${props.goheapsys}`}</Kb.Text>
      <Kb.Text style={styles.stat} type="BodyTiny">{`GoReleased: ${props.goreleased}`}</Kb.Text>
    </Kb.Box2>
  )
}

export const RuntimeStatsMobile = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.Box2 direction="horizontal" gap="xxtiny">
        <Kb.Text style={styles.stat} type="BodyTiny">{`C:${props.cpu}`}</Kb.Text>
        <Kb.Text style={styles.stat} type="BodyTiny">{`R:${props.resident}`}</Kb.Text>
        <Kb.Text style={styles.stat} type="BodyTiny">{`V:${props.virt}`}</Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" gap="xxtiny">
        <Kb.Text style={styles.stat} type="BodyTiny">{`GH:${props.goheap}`}</Kb.Text>
        <Kb.Text style={styles.stat} type="BodyTiny">{`GS:${props.goheapsys}`}</Kb.Text>
        <Kb.Text style={styles.stat} type="BodyTiny">{`GR:${props.goreleased}`}</Kb.Text>
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
})
