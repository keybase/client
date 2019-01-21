// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {HeaderHocHeader} from '.'

const onAction = Sb.action('onAction')
const rightActions = (length: number = 3) => (
  [{
    icon: 'iconfont-new',
    label: 'Add new…',
    onPress: onAction,
  }, {
    icon: 'iconfont-chat',
    label: 'Start a conversation',
    onPress: onAction,
  }, {
    icon: 'iconfont-upload',
    label: 'Upload a file',
    onPress: onAction,
  }, {
    icon: 'iconfont-reacji',
    label: 'Add a reaction',
    onPress: onAction,
  }, {
    icon: 'iconfont-bomb',
    label: 'Blow something up',
    onPress: onAction,
  }, {
    icon: 'iconfont-time-reversed',
    label: 'Movie trope',
    onPress: onAction,
  }].slice(0, length)
)

const load = () => {
  Sb.storiesOf('Common/Header', module)
    .add('Simple', () => <HeaderHocHeader title="This is a title" />)
    .add('Long Title', () => <HeaderHocHeader title="This is an obnoxiously, over the top, ridiculously long title" />)
    .add('Back', () => <HeaderHocHeader title="This is a title" onLeftAction={onAction} />)
    .add('Back and Badge', () => <HeaderHocHeader title="This is a title" onLeftAction={onAction} badgeNumber={42} />)
    .add('Cancel', () => <HeaderHocHeader title="This is a title" onLeftAction={onAction} leftAction="cancel" />)
    .add('Close', () => <HeaderHocHeader title="This is a title" onLeftAction={onAction} leftAction="cancel" leftActionText="Close" />)
    .add('Cancel and Done', () => <HeaderHocHeader title="This is a title" onLeftAction={onAction} leftAction="cancel" rightActions={[{ label: 'Done', onPress: onAction }]} />)
    .add('1 Right Action', () => <HeaderHocHeader title="This is a title" rightActions={rightActions(1)} />)
    .add('2 Right Actions', () => <HeaderHocHeader title="This is a title" rightActions={rightActions(2)} />)
    .add('3 Right Actions', () => <HeaderHocHeader title="This is a title" rightActions={rightActions()} />)
    .add('6 Right Actions', () => <HeaderHocHeader title="This is a title" rightActions={rightActions(6)} />)
    .add('Back and 1 Right Action', () => <HeaderHocHeader title="This is a title" onLeftAction={onAction} rightActions={rightActions(1)} />)
    .add('Back and 2 Right Actions', () => <HeaderHocHeader title="This is a title" onLeftAction={onAction} rightActions={rightActions(2)} />)
    .add('Back and 3 Right Actions', () => <HeaderHocHeader title="This is a title" onLeftAction={onAction} rightActions={rightActions()} />)
    .add('Back and 6 Right Actions', () => <HeaderHocHeader title="This is a title" onLeftAction={onAction} rightActions={rightActions(6)} />)
    .add('Back and 6 Right Actions and Long Title', () => <HeaderHocHeader title="This is an obnoxiously, over the top, ridiculously long title" onLeftAction={onAction} rightActions={rightActions(6)} />)
}

export default load
