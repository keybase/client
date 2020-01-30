import * as React from 'react'
import * as Kb from '../common-adapters'
import range from 'lodash/range'
import * as Styles from '../styles'

function Stars({count}: {count: number}) {
  return (
    <Kb.Box style={Styles.globalStyles.flexBoxRow}>
      {range(count).map(i => (
        <Kb.Icon
          key={i}
          color={Styles.globalColors.green}
          type={Kb.Icon.makeFastType(Kb.IconType.iconfont_star)}
        />
      ))}
    </Kb.Box>
  )
}

export {Stars}
