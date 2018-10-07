// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import NoteAndMemo from '.'

const commonProps = {
  publicMemo: '',
  secretNote: '',
  onChangePublicMemo: Sb.action('onChangePublicMemo'),
  onChangeSecretNote: Sb.action('onChangeSecretNote'),
}
const load = () => {
  Sb.storiesOf('Wallets/SendForm/Note and Memo', module)
    .add('Normal input', () => <NoteAndMemo {...commonProps} />)
    .add('Input with a note error', () => (
      <NoteAndMemo {...commonProps} secretNoteError="There's something wrong with your note." />
    ))
    .add('Input with a memo error', () => (
      <NoteAndMemo {...commonProps} publicMemoError="There's something wrong with your memo." />
    ))
    .add('Prefilled', () => (
      <NoteAndMemo
        {...commonProps}
        secretNote="This is a prefilled secret note"
        publicMemo="This is a prefilld pblc memo"
      />
    ))
    .add('Prefilled w/ errors', () => (
      <NoteAndMemo
        {...commonProps}
        secretNote="This is a prefilled secret note"
        publicMemo="This is a prefilled public memo"
        publicMemoError="Memo is too long"
      />
    ))
}

export default load
