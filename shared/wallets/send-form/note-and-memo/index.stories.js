// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import NoteAndMemo from '.'

const commonProps = {
  onChangePublicMemo: Sb.action('onChangePublicMemo'),
  onChangeSecretNote: Sb.action('onChangeSecretNote'),
}
const load = () => {
  Sb.storiesOf('Wallets/SendForm/Note and Memo', module)
    .add('Normal input', () => <NoteAndMemo {...commonProps} />)
    .add('Input with a note error', () => (
      <NoteAndMemo {...commonProps} noteError="There's something wrong with your note." />
    ))
    .add('Input with a memo error', () => (
      <NoteAndMemo {...commonProps} memoError="There's something wrong with your memo." />
    ))
}

export default load
