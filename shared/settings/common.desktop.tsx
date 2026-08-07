import * as Kb from '@/common-adapters'

function Stars({count}: {count: number}) {
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2 direction="horizontal">
      {Array.from({length: count}, (_, i) => i).map(i => (
        <Kb.Icon key={i} color={theme.green} type="iconfont-star" />
      ))}
    </Kb.Box2>
  )
}

export {Stars}
