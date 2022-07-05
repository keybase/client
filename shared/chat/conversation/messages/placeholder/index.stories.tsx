import React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {storiesOf} from '../../../../stories/storybook'
import MessagePlaceholder from '.'

const load = () => {
  storiesOf('Chat/Conversation/Rows', module).add('Placeholder', () => (
    <>
      <MessagePlaceholder ordinal={Types.numberToOrdinal(1)} />
      <MessagePlaceholder ordinal={Types.numberToOrdinal(2)} />
      <MessagePlaceholder ordinal={Types.numberToOrdinal(3)} />
      <MessagePlaceholder ordinal={Types.numberToOrdinal(4)} />
      <MessagePlaceholder ordinal={Types.numberToOrdinal(5)} />
      <MessagePlaceholder ordinal={Types.numberToOrdinal(6)} />
      <MessagePlaceholder ordinal={Types.numberToOrdinal(7)} />
      <MessagePlaceholder ordinal={Types.numberToOrdinal(7.001)} />
      <MessagePlaceholder ordinal={Types.numberToOrdinal(7.002)} />
      <MessagePlaceholder ordinal={Types.numberToOrdinal(8)} />
    </>
  ))
}

export default load
