import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {KnowPassword, EnterPassword} from './password'

const store = Sb.createStoreWithCommon()

const load = () => {
  Sb.storiesOf('Login/Reset', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Do you know your password?', () => <KnowPassword />)
    .add('Enter password', () => <EnterPassword />)
}

export default load
