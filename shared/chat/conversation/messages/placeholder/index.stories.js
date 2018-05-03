// @flow
import React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {storiesOf} from '../../../../stories/storybook'
import Placeholder from '.'

const load = () => {
  storiesOf('Chat/Conversation/Rows', module).add('Placeholder', () => (
    <React.Fragment>
      <Placeholder ordinal={Types.numberToOrdinal(1)} />
      <Placeholder ordinal={Types.numberToOrdinal(2)} />
      <Placeholder ordinal={Types.numberToOrdinal(3)} />
      <Placeholder ordinal={Types.numberToOrdinal(4)} />
      <Placeholder ordinal={Types.numberToOrdinal(5)} />
      <Placeholder ordinal={Types.numberToOrdinal(6)} />
      <Placeholder ordinal={Types.numberToOrdinal(7)} />
      <Placeholder ordinal={Types.numberToOrdinal(7.001)} />
      <Placeholder ordinal={Types.numberToOrdinal(7.002)} />
      <Placeholder ordinal={Types.numberToOrdinal(8)} />
    </React.Fragment>
  ))
}

export default load
