import * as React from 'react'
import {Emoji} from 'emoji-mart'

// Just the single set we use
// @ts-ignore
import emojiSet from 'emoji-datasource-apple/img/apple/sheets/64.png'

import {Props} from './emoji'

const backgroundImageFn = (_: string, __: number) => emojiSet

// Size 0 is cause we want the native emoji for copy/paste and not for rendering
const EmojiWrapper = (props: Props) => {
  const {emojiName, size} = props
  return (
    <Emoji emoji={emojiName} size={size} backgroundImageFn={backgroundImageFn} tooltip={true}>
      {!props.disableSelecting && <Emoji emoji={emojiName} size={0} native={true} />}
    </Emoji>
  )
}

export {backgroundImageFn}

export default EmojiWrapper
