import {Rnd} from '../../../../stories/storybook'
import * as I from 'immutable'
import * as Types from '../../../../constants/types/chat2'
import {emojiIndexByName} from '../../../../common-adapters/markdown/emoji-gen'
import {OwnProps} from './container'
import {Props as ViewProps} from '.'

const emojiNames = Object.keys(emojiIndexByName)
const numEmojis = emojiNames.length

const ordinalToEmojis = (m: Types.Ordinal) => {
  const n = Types.ordinalToNumber(m)
  if (n % 4 === 0) {
    const r = new Rnd(n)
    const numReactions = r.next() % 5
    const res: Array<string> = []
    for (let i = 0; i < numReactions; i++) {
      res.push(emojiNames[r.next() % numEmojis])
    }
    return I.Set(res).toArray()
  }
  return []
}

export const propProvider = {
  ReactionsRow: (props: OwnProps): ViewProps => ({
    conversationIDKey: props.conversationIDKey,
    emojis: ordinalToEmojis(props.ordinal),
    ordinal: props.ordinal,
  }),
}
