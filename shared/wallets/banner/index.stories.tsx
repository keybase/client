import * as React from 'react'
import {Box} from '../../common-adapters'
import Banner, {Props} from '.'
import {AdvancedBanner} from '../../constants/types/rpc-stellar-gen'
import * as Sb from '../../stories/storybook'

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
  {
    background: 'Announcements' as const,
    offerAdvancedSendForm: AdvancedBanner.receiverBanner,
    onAction: Sb.action('onAction'),
    text: '',
  },
  {
    background: 'Announcements' as const,
    offerAdvancedSendForm: AdvancedBanner.senderBanner,
    onAction: Sb.action('onAction'),
    text: '',
  },
]

const load = () => {
  const story = Sb.storiesOf('Wallets/SendForm/Banner', module).addDecorator(story => (
    <Box style={{maxWidth: 400}}>{story()}</Box>
  ))
  examples.forEach((ex, index) => story.add(`Example ${index + 1}`, () => <Banner {...ex} />))
}

export default load
