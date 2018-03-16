// @flow
import * as React from 'react'
import View from './view'

// -1 === keep forever, all other in days
type RetentionPolicy = 1 | 7 | 30 | 90 | 365 | -1
const retentionOptions: RetentionPolicy[] = [1, 7, 30, 90, 365, -1]
const retentionDisplay: string[] = retentionOptions.map(o => {
  let res = ''
  if (o > 0) {
    res = `${o} day`
    if (o > 1) {
      res += 's'
    }
    return res
  }
  return 'Keep forever'
})

type Seconds = number
const secondsPerDay = 3600 * 24

export type Props = {
  teamDefault: Seconds,
  selected: Seconds,
}

export default class extends React.Component<Props> {
  componentWillMount() {
    // if no data, load data
  }

  render() {
    return <View {...this.props} />
  }
}
