import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'

const long = 22
const small = 4
const padding = 5

const QRScanLines = ({canScan, color}: {canScan: boolean; color?: Styles.Color}) => {
  const s = [styles.common, {backgroundColor: color}]
  return canScan ? (
    <>
      <Kb.Box
        style={Styles.collapseStyles([...s, {height: long, left: padding, top: padding, width: small}])}
      />
      <Kb.Box
        style={Styles.collapseStyles([...s, {height: small, left: padding, top: padding, width: long}])}
      />
      <Kb.Box
        style={Styles.collapseStyles([...s, {height: long, right: padding, top: padding, width: small}])}
      />
      <Kb.Box
        style={Styles.collapseStyles([...s, {height: small, right: padding, top: padding, width: long}])}
      />
      <Kb.Box
        style={Styles.collapseStyles([...s, {bottom: padding, height: long, left: padding, width: small}])}
      />
      <Kb.Box
        style={Styles.collapseStyles([...s, {bottom: padding, height: small, left: padding, width: long}])}
      />
      <Kb.Box
        style={Styles.collapseStyles([...s, {bottom: padding, height: long, right: padding, width: small}])}
      />
      <Kb.Box
        style={Styles.collapseStyles([...s, {bottom: padding, height: small, right: padding, width: long}])}
      />
    </>
  ) : null
}

const styles = Styles.styleSheetCreate(() => ({
  common: {position: 'absolute'},
}))

export default QRScanLines
