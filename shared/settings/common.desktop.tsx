import * as Kb from '@/common-adapters'
import range from 'lodash/range'

function Stars({count}: {count: number}) {
  return (
    <Kb.Box style={Kb.Styles.globalStyles.flexBoxRow}>
      {range(count).map(i => (
        <Kb.Icon key={i} color={Kb.Styles.globalColors.green} type="iconfont-star" />
      ))}
    </Kb.Box>
  )
}

export {Stars}
