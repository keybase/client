import * as Constants from '../../constants/devices'
import * as I from 'immutable'
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import HiddenString from '../../util/hidden-string'
import PaperKey from '.'

const common = Sb.createStoreWithCommon()

const store = {
  ...common,
  devices: common.devices.mergeDeep(
    I.Map({
      newPaperkey: new HiddenString('one two three four five six seven eight nine'),
    })
  ),
}

const waitingStore = {
  ...store,
  devices: common.devices.mergeDeep(
    I.Map({
      newPaperkey: new HiddenString(''),
    })
  ),
  waiting: store.waiting.mergeDeep({
    counts: I.Map([[Constants.waitingKey, 1]]),
  }),
}
const load = () => {
  Sb.storiesOf('Devices/Paperkey', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Normal', () => <PaperKey />)
  Sb.storiesOf('Devices/Paperkey', module)
    .addDecorator((story: any) => <Sb.MockStore store={waitingStore}>{story()}</Sb.MockStore>)
    .add('Waiting', () => <PaperKey />)
}

export default load
