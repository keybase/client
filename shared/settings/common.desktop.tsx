import * as Kb from '@/common-adapters'
import range from 'lodash/range'

function Stars({count}: {count: number}) {
  return (
    <Kb.Box2 direction="horizontal">
      {range(count).map(i => (
        <Kb.Icon key={i} color={Kb.Styles.globalColors.green} type="iconfont-star" />
      ))}
    </Kb.Box2>
  )
}

export {Stars}
