import * as Kb from '@/common-adapters'

function Stars({count}: {count: number}) {
  return (
    <Kb.Box2 direction="horizontal">
      {Array.from({length: count}, (_, i) => i).map(i => (
        <Kb.Icon2 key={i} color={Kb.Styles.globalColors.green} type="iconfont-star" />
      ))}
    </Kb.Box2>
  )
}

export {Stars}
