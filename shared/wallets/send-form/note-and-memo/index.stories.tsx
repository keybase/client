import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {SecretNote, PublicMemo} from '.'

const commonProps = {
  onChangePublicMemo: Sb.action('onChangePublicMemo'),
  onChangeSecretNote: Sb.action('onChangeSecretNote'),
  publicMemo: '',
  secretNote: '',
}
const load = () => {
  Sb.storiesOf('Wallets/SendForm/Note and Memo', module)
    .add('Normal input', () => <SecretNote {...commonProps} />)
    .add('Input with a note error', () => (
      <SecretNote {...commonProps} secretNoteError="There's something wrong with your note." />
    ))
    .add('Input with a memo error', () => (
      <PublicMemo {...commonProps} publicMemoError="There's something wrong with your memo." />
    ))
    .add('Prefilled SecretNote', () => (
      <SecretNote {...commonProps} secretNote="This is a prefilled secret note" />
    ))
    .add('Prefilled PublicMemo', () => (
      <PublicMemo {...commonProps} publicMemo="This is a prefilld pblc memo" />
    ))
    .add('Prefilled SecretNote w/ errors', () => (
      <SecretNote
        {...commonProps}
        secretNote="This is a prefilled secret note"
        secretNoteError="Note is too long"
      />
    ))
    .add('Prefilled PublicMemo w/ errors', () => (
      <PublicMemo
        {...commonProps}
        publicMemo="This is a prefilled public memo"
        publicMemoError="Memo is too long"
      />
    ))
}

export default load
