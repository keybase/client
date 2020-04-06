import * as React from 'react'
import * as Sb from '../stories/storybook'
import Reloadable from './reload'
import Text from './text'
import {Box2} from './box'

const Kb = {
  Box2,
  Reloadable,
  Text,
}

const provider = Sb.createPropProviderWithCommon({
  Reloadable: p => ({
    children: p.children,
    needsReload: p.needsReload,
    onBack: p.onBack,
    onReload: p.onReload,
    reason: p.reason,
    reloadOnMount: p.reloadOnMount,
    title: p.title,
  }),
})

const Child = () => <Kb.Text type="Body">I dont need reload</Kb.Text>

const props = {
  onReload: Sb.action('onReload'),
  waitingKeys: 'abc',
}

const longReason = new Array(1000).fill('0123456789')

const load = () => {
  Sb.storiesOf('Common/Reload', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        {story()}
      </Kb.Box2>
    ))
    .add('No reload', () => (
      // @ts-ignore need that helper thats not merged yet
      <Kb.Reloadable {...props} needsReload={false} reason="">
        <Child />
      </Kb.Reloadable>
    ))
    .add('Reload', () => (
      // @ts-ignore need that helper thats not merged yet
      <Kb.Reloadable {...props} needsReload={true} reason="reason field">
        <Child />
      </Kb.Reloadable>
    ))
    .add('Reload long', () => (
      // @ts-ignore need that helper thats not merged yet
      <Kb.Reloadable {...props} needsReload={true} reason={longReason}>
        <Child />
      </Kb.Reloadable>
    ))
    .add('Reload with back', () => (
      <Kb.Reloadable
        {...props}
        onBack={Sb.action('onBack')}
        // @ts-ignore TS is correct its not a prop in the regular connect
        needsReload={true}
        reason={longReason}
        title="Title"
      >
        <Child />
      </Kb.Reloadable>
    ))
}

export default load
