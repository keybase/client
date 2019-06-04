import * as React from 'react'
import {storiesOf} from '../../stories/storybook'
import {Box} from '../../common-adapters'
import Banner, {Props} from '.'

const examples: Props[] = [
  {
    background: 'Announcements' as const,
    text: 'Because it’s russel’s first transaction, you must send at least 2 XLM.',
  },
  {
    background: 'Announcements' as const,
    text: 'russel has a maximum allowed balance of this asset. You may send a maximum of 880.2387456.',
  },
  {background: 'HighRisk' as const, text: 'Connection error. You are offline.'},
]

const load = () => {
  const story = storiesOf('Wallets/SendForm/Banner', module).addDecorator(story => (
    <Box style={{maxWidth: 400}}>{story()}</Box>
  ))
  examples.forEach((ex, index) => story.add(`Example ${index + 1}`, () => <Banner {...ex} />))
}

export default load
