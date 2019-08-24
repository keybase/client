import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import AddToChannel from '.'

const props = {
  error: null,
  onCancel: Sb.action('onCancel'),
  onSubmit: Sb.action('onSubmit'),
  title: 'Add to #random',
  users: [
    {alreadyAdded: false, fullname: 'Danny Ayoub', username: 'ayoubd'},
    {alreadyAdded: false, fullname: 'Miles Steele', username: 'mlsteele'},
    {alreadyAdded: false, fullname: 'Karen Maxim', username: 'karenm'},
    {alreadyAdded: false, fullname: 'Chris Nojima', username: 'chrisnojima'},
    {alreadyAdded: false, fullname: 'Josh Blum', username: 'joshblum'},
    {
      alreadyAdded: false,
      fullname: 'Very very very very very very very very very long fullname',
      username: 'dannytest999',
    },
    {alreadyAdded: true, fullname: 'Chris Ball', username: 'cjb'},
    {alreadyAdded: true, fullname: 'Fred Akalin', username: 'akalin'},
    {alreadyAdded: true, fullname: 'Steve Sanders', username: 'zanderz'},
    {alreadyAdded: true, fullname: '', username: 'reallyreallylongusername'},
  ],
  waitingKey: 'dummyWaitingKey',
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/InfoPanel', module)
    .addDecorator(Sb.createPropProviderWithCommon())
    .add('Add to channel', () => <AddToChannel {...props} />)
    .add('Add to channel error', () => (
      <AddToChannel {...props} error="We had a problem connecting to the internet. Try again." />
    ))
}

export default load
