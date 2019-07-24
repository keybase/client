import * as React from 'react'
import * as Sb from '../stories/storybook'
import Reloadable from './reload'
import Text from './text'
import {Box2} from './box'

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

const Child = () => <Text type="Body">I dont need reload</Text>

const props = {
  onReload: Sb.action('onReload'),
  waitingKeys: 'abc',
}

const longReason = new Array(1000).fill('0123456789')

const load = () => {
  Sb.storiesOf('Common/Reload', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        {story()}
      </Box2>
    ))
    .add('No reload', () => (
      // @ts-ignore need that helper thats not merged yet
      <Reloadable {...props} needsReload={false} reason="">
        <Child />
      </Reloadable>
    ))
    .add('Reload', () => (
      // @ts-ignore need that helper thats not merged yet
      <Reloadable {...props} needsReload={true} reason="reason field">
        <Child />
      </Reloadable>
    ))
    .add('Reload long', () => (
      // @ts-ignore need that helper thats not merged yet
      <Reloadable {...props} needsReload={true} reason={longReason}>
        <Child />
      </Reloadable>
    ))
    .add('Reload with back', () => (
      // @ts-ignore need that helper thats not merged yet
      <Reloadable
        {...props}
        onBack={Sb.action('onBack')}
        needsReload={true}
        reason={longReason}
        title="Title"
      >
        <Child />
      </Reloadable>
    ))
}

export default load
