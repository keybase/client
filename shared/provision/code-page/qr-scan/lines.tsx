import * as Kb from '@/common-adapters'

const long = 22
const small = 4
const padding = 5

const QRScanLines = ({canScan, color}: {canScan: boolean; color?: Kb.Styles.Color}) => {
  const styles = useStyles()
  const s = [styles.common, {backgroundColor: color}]
  return canScan ? (
    <>
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([...s, {height: long, left: padding, top: padding, width: small}])}
      />
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([...s, {height: small, left: padding, top: padding, width: long}])}
      />
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([...s, {height: long, right: padding, top: padding, width: small}])}
      />
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([...s, {height: small, right: padding, top: padding, width: long}])}
      />
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([...s, {bottom: padding, height: long, left: padding, width: small}])}
      />
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([...s, {bottom: padding, height: small, left: padding, width: long}])}
      />
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([
          ...s,
          {bottom: padding, height: long, right: padding, width: small},
        ])}
      />
      <Kb.Box2
        direction="vertical"
        style={Kb.Styles.collapseStyles([
          ...s,
          {bottom: padding, height: small, right: padding, width: long},
        ])}
      />
    </>
  ) : null
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  common: {position: 'absolute'},
}))

export default QRScanLines
