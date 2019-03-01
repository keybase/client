// @flow
import * as React from 'react'
import {Box} from '../../../../common-adapters/index'
import * as Sb from '../../../../stories/storybook'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

import CoinFlip from '.'
import CoinFlipParticipants from './participants'

const commitmentVis =
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAABkCAIAAADmAnnJAAACxklEQVR4nOzdr2vVfxTH8buxL+wrihN/YDAoKiw4WRgy/QNExBURFCw24TZXtInJYbdYDVoMBrEMcSgoQxCDsomI+AMMDgYaDEP9B84Jy6/HIx70fT/3/dmTG8/Y7pm/g8qOlXI8uHiont//Uc+/1+PBlX31/PVGPV9dr+cfx+v53a/1/N3+ej49Vs8fNvdwYW89f/y7nq8097PcPM/ch3q+Ol3Pt7+q50sz9fx48zwvJur51ea93Gvu+fpkPb/d3POwubfl5h6693iqOb97ztF6DBkEQDQBEE0ARBMA0QRANAEQTQBEEwDRBEA0ARBNAEQTANEEQDQBEE0ARBMA0QRANAEQTQBEEwDRBEA0ARBNAEQTANEEQDQBEE0ARBMA0QRANAEQTQBEGzk3qBdknJit/8NaszBiofmAxSP1fO55PZ/f5AKLN818vdnM8a1ZtNHsuxg8bZ7/bLPQYaFZJHGy+ff/NYtCppoFFk+aRQ9ndtXzxWY+07zHB819/t8s5hh9Wc8/N+/xRnP/a8093Npaz6/V48GB5vy3zff1C0A0ARBNAEQTANEEQDQBEE0ARBMA0QRANAEQTQBEEwDRBEA0ARBNAEQTANEEQDQBEE0ARBMA0QRANAEQTQBEEwDRBEA0ARBNAEQTANEEQDQBEE0ARBMA0QRAtJHhbL0hptuwcn6inn9qNnBsTNbzqV/1/FmzSeVgs3nlUvOcc83GkT3N+UvNRpbu+35pvtfOZoPLluZzu+97rNmwcnh8c597szn/aDP/2dzzo2ZTzp/mnNPNc15u3tf75u9hW3POneZ+hs05882mGb8ARBMA0QRANAEQTQBEEwDRBEA0ARBNAEQTANEEQDQBEE0ARBMA0QRANAEQTQBEEwDRBEA0ARBNAEQTANEEQDQBEE0ARBMA0QRANAEQTQBEEwDRBEA0ARDtXwAAAP//CXFl07CQj7gAAAAASUVORK5CYII='

const revealVis =
  'iVBORw0KGgoAAAANSUhEUgAAAQAAAABkCAIAAADmAnnJAAACV0lEQVR4nOzdPWtfBRyG4SgBEVFQNBhURB1cFFHRwUVw9QM4OLiJ+K1E3DXq4qaI4uQgiEF8KV06tJRCl1JKupf/Q+l8X9f4nCEhOTdn/B1ffHd02NnYnxj7+dg/HvtPY/9z7O+N/cWxXx3782P/b+y3xn469tfG/vXY/xj7G2N/ZOwPj/1k7E+O/ZuxPzP2G2P/aOz/j339358b+0tjf3TsXxye158NEgRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkHZ89OV4sg5brAME18e+DkC8cJ/f7F6Pjf3fsV8b+6Wxvzn2H8f+/th/G/uHY3917FfGvg5//DP2z8f+89hfHvvfY39r7Bdj/33sH4x9vSffjv3dsb9zePYFIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIO2hi7Px5PbYj8e+LsFcHvvTYz8d+ysP+HN/HftnY/9q7DfH/vbY18WXp8a+LtasizjnYz8Z+19jf33sP4z9k7F/P/Z1MejZsT8+9l/Gvt7PT8d+5/DsC0CaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDS7gYAAP//uv4yGmIckmcAAAAASUVORK5CYII='

const parts = [
  {
    commitment: '',
    deviceID: '',
    deviceName: 'lisa-5k',
    uid: '',
    username: 'mikem',
  },
  {
    commitment: '',
    deviceID: '',
    deviceName: 'work computer',
    uid: '',
    username: 'max',
  },
  {
    commitment: '',
    deviceID: '',
    deviceName: 'My Mac Home Device',
    uid: '',
    username: 'karenm',
  },
  {
    commitment: '',
    deviceID: '',
    deviceName: 'dsdsdkjsdjskdjskdjskkskjsd',
    uid: '',
    username: 'chris',
  },
]

const gathering = {
  commitmentVis: '',
  participants: [],
  phase: 'commitments',
  progressText: 'Gathering commitments...',
  resultText: '',
  revealVis: '',
  showParticipants: false,
}

const partialGather = {
  commitmentVis,
  participants: parts.slice(0, 2),
  phase: 'commitments',
  progressText: 'Gathered 2 commitments...',
  resultText: '',
  revealVis: '',
  showParticipants: false,
}

const result = {
  commitmentVis,
  participants: parts,
  phase: 'complete',
  progressText: '2 participants have revealed secrets...',
  resultText: 'HEADS',
  revealVis,
  showParticipants: true,
}

const error = {
  commitmentVis: '',
  errorInfo: {
    generic: 'Something went wrong: Somebody pulled the plug',
    typ: RPCChatTypes.chatUiUICoinFlipErrorTyp.generic,
  },
  participants: [],
  phase: 'complete',
  progressText: 'Something went wrong: Somebody pulled the plug',
  resultText: '',
  revealVis: '',
  showParticipants: false,
}

const absenteeError = {
  commitmentVis: '',
  errorInfo: {
    absentee: {
      absentees: [
        {
          device: 'boombox',
          user: 'mikem',
        },
        {
          device: 'walkietalkie',
          user: 'karenm',
        },
        {
          device: 'longer device name',
          user: 'dan',
        },
      ],
    },
    typ: RPCChatTypes.chatUiUICoinFlipErrorTyp.absentee,
  },
  participants: [],
  phase: 'complete',
  progressText: 'Something went wrong: Somebody pulled the plug',
  resultText: '',
  revealVis: '',
  showParticipants: false,
}

const participantProps = {
  attachTo: Sb.action('mocked'),
  onHidden: Sb.action('onHidden'),
  participants: parts,
  visible: true,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Coinflip', module)
    .addDecorator(story => <Box style={{maxWidth: 400, padding: 5}}>{story()}</Box>)
    .add('Gathering', () => <CoinFlip {...gathering} />)
    .add('Partial Gather', () => <CoinFlip {...partialGather} />)
    .add('Result', () => <CoinFlip {...result} />)
    .add('Error', () => <CoinFlip {...error} />)
    .add('Absentee Error', () => <CoinFlip {...absenteeError} />)
    .add('Participants', () => <CoinFlipParticipants {...participantProps} />)
}

export default load
