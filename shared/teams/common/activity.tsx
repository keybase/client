import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type ActivityLevel = 'active' | 'recently' | 'extinct'
const activityToIcon: {[key in ActivityLevel]: Kb.IconType} = {
  active: 'iconfont-fire',
  extinct: 'iconfont-rip',
  recently: 'iconfont-team-leave',
}
const activityToLabel = {
  active: 'Active',
  extinct: 'Extinct',
  recently: 'Recently active',
}
const Activity = ({level}: {level: ActivityLevel}) => (
  <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={Styles.isMobile}>
    <Kb.Icon
      type={activityToIcon[level]}
      color={level === 'active' ? Styles.globalColors.greenDark : Styles.globalColors.black_50}
      sizeType="Small"
    />
    <Kb.Text type="BodySmall" style={level === 'active' && styles.activityActive}>
      {activityToLabel[level]}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  activityActive: {
    color: Styles.globalColors.greenDark,
  },
}))

export default Activity
