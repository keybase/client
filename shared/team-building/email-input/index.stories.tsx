import * as React from 'react'
import * as Sb from '../../stories/storybook'
import EmailInput from '.'

const namespace = 'chat2'

const storeCommon = Sb.createStoreWithCommon()
const store = {
  ...storeCommon,
  [namespace]: storeCommon[namespace].setIn(['teamBuilding', 'teamBuildingEmailResult'], {
    id: '[max@keybase.io]@email',
    label: '',
    prettyName: 'max@keybase.io',
    serviceId: 'contact',
    serviceMap: {keybase: 'max'},
    username: 'max@keybase',
  }),
}

const load = () => {
  Sb.storiesOf('Team-Building', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Email address', () => <EmailInput namespace={namespace} />)
}

export default load
