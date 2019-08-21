import * as React from 'react'
import * as Sb from '../../stories/storybook'
import EmailInput from '.'

const namespace = 'chat2'

const storeCommon = Sb.createStoreWithCommon()
const store = {
  ...storeCommon,
  [namespace]: storeCommon[namespace].setIn(['teamBuilding', 'teamBuildingEmailResult'], {
    id: '[max@keyba.se]@email',
    label: '',
    prettyName: 'max@keyba.se',
    serviceId: 'contact',
    serviceMap: {keybase: 'max'},
    username: 'max@keyba.se',
  }),
}

const load = () => {
  console.log('storeCommon:', storeCommon)
  Sb.storiesOf('Team-Building', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Email address', () => <EmailInput namespace={namespace} />)
}

export default load
