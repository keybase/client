import * as Constants from '../../constants/devices'
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import PaperKey from '.'

const common = Sb.createStoreWithCommon()

const store = Container.produce(common, draftState => {
  draftState.devices.newPaperkey = new Container.HiddenString('one two three four five six seven eight nine')
})

const waitingStore = Container.produce(store, draftState => {
  draftState.devices.newPaperkey = new Container.HiddenString('')
  draftState.waiting = Container.produce(store.waiting, draftState => {
    const counts = new Map(draftState.counts)
    counts.set(Constants.waitingKey, 1)
    draftState.counts = counts
  })
})

const load = () => {
  Sb.storiesOf('Devices/Paperkey', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Normal', () => <PaperKey />)
  Sb.storiesOf('Devices/Paperkey', module)
    .addDecorator((story: any) => <Sb.MockStore store={waitingStore}>{story()}</Sb.MockStore>)
    .add('Waiting', () => <PaperKey />)
}

export default load
