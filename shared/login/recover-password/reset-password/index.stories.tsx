import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ResetPassword from '.'

const store = Sb.createStoreWithCommon()

const load = () => {
  Sb.storiesOf('Login/RecoverPassword/ResetPassword', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Prompt', () => <ResetPassword />)
}

export default load
