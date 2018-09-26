// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

export type WalletsIconProps = {|
  isNew: boolean,
  onClick: () => void,
  size: number,
  style?: Styles.StylesCrossPlatform,
|}
const WalletsIcon = ({isNew, onClick, size, style}: WalletsIconProps) => (
  <Kb.Box2 direction="horizontal" style={Styles.collapseStyles([styles.container, style])}>
    <Kb.Icon type="iconfont-dollar-sign" fontSize={size} onClick={onClick} />
    {isNew && <Kb.Box style={styles.newBadge} />}
  </Kb.Box2>
)

const radius = 4
const styles = Styles.styleSheetCreate({
  container: {
    position: 'relative',
  },
  newBadge: {
    backgroundColor: Styles.globalColors.blue,
    borderColor: Styles.globalColors.white,
    borderRadius: radius,
    borderStyle: 'solid',
    borderWidth: 1,
    height: radius * 2,
    position: 'absolute',
    right: -1,
    top: -2,
    width: radius * 2,
  },
})

export default WalletsIcon
