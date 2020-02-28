import * as React from 'react'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/tracker2'

const assertionColorToTextColor = (c: Types.AssertionColor) => {
  switch (c) {
    case 'blue':
      return Styles.globalColors.blue
    case 'red':
      return Styles.globalColors.redDark
    case 'black':
      return Styles.globalColors.black
    case 'green':
      return Styles.globalColors.greenDark
    case 'gray':
      return Styles.globalColors.black_50
    case 'yellow': // fallthrough
    case 'orange':
    default:
      return Styles.globalColors.redDark
  }
}

export const useGetIDInfo = (
  username: string
): {
  color: ReturnType<typeof assertionColorToTextColor>
  following: boolean
  load: () => void
  percentDone: number
  running: boolean
} => {
  const [running, setRunning] = React.useState(false)

  const details = Container.useSelector(state => state.tracker2.usernameToDetails.get(username))
  const following = Container.useSelector(state => state.config.following.has(username))
  const m: Map<string, Types.Assertion> = details?.assertions ?? new Map()
  const entries = [...m.entries()]

  let total = 0
  let finished = 0
  const startColor = (following ? 'green' : 'blue') as Types.AssertionColor
  let ac = startColor

  entries.forEach(([_a, d]) => {
    total++
    switch (d.state) {
      case 'checking':
        break
      case 'valid':
        finished++
        break
      case 'error':
        finished++
        ac = 'red'
        break
      case 'warning':
        finished++
        break
      case 'revoked':
        finished++
        break
      case 'suggestion':
        finished++
        break
    }
  })

  const percentDone = total > 0 ? finished / total : 0

  const load = () => {
    console.log('aa toDO')
    setRunning(true)
  }

  // allow it to change immediately?
  //const finalColor = ac

  let finalColor = ac

  switch (details?.state) {
    case 'valid':
      finalColor = startColor
      break
    case 'broken':
      finalColor = 'red'
      break
  }

  return {color: assertionColorToTextColor(finalColor), load, percentDone, running, following}
}
