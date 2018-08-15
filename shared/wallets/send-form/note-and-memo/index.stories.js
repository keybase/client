// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import NoteAndMemo from '.'

const load = () => {
  Sb.storiesOf('Wallets/SendForm/Note and Memo', module)
    .add('Normal input', () => <NoteAndMemo />)
    .add('Input with a note error', () => <NoteAndMemo noteError="There's something wrong with your note." />)
    .add('Input with a memo error', () => <NoteAndMemo memoError="There's something wrong with your memo." />)
}

export default load
