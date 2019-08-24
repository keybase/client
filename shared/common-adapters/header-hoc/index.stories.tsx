import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../'
import {HeaderHocHeader} from '.'
import {Action} from './types'

const onAction = Sb.action('onAction')
const rightActions = (length: number = 3): Action[] =>
  [
    {
      icon: 'iconfont-new' as 'iconfont-new',
      label: 'Add new…',
      onPress: onAction,
    },
    {
      icon: 'iconfont-chat' as 'iconfont-chat',
      label: 'Start a conversation',
      onPress: onAction,
    },
    {
      icon: 'iconfont-upload' as 'iconfont-upload',
      label: 'Upload a file',
      onPress: onAction,
    },
    {
      icon: 'iconfont-reacji' as 'iconfont-reacji',
      label: 'Add a reaction',
      onPress: onAction,
    },
    {
      icon: 'iconfont-bomb' as 'iconfont-bomb',
      label: 'Blow something up',
      onPress: onAction,
    },
    {
      icon: 'iconfont-time-reversed' as 'iconfont-time-reversed',
      label: 'Movie trope',
      onPress: onAction,
    },
  ].slice(0, length)
const title = 'This is a title'
const longTitle = 'This is an obnoxiously, over the top, ridiculously long title'
const titleComponent = <Kb.Button label={title} small={true} style={{width: '100%'}} />

const load = () => {
  Sb.storiesOf('Common/Header', module)
    .add('Simple', () => <HeaderHocHeader title={title} />)
    .add('Long Title', () => <HeaderHocHeader title={longTitle} />)
    .add('Back', () => <HeaderHocHeader title={title} onLeftAction={onAction} />)
    .add('Back and Badge', () => <HeaderHocHeader title={title} onLeftAction={onAction} badgeNumber={42} />)
    .add('Back and Badge and Long Title', () => (
      <HeaderHocHeader title={longTitle} onLeftAction={onAction} badgeNumber={42} />
    ))
    .add('Cancel', () => <HeaderHocHeader title={title} onLeftAction={onAction} leftAction="cancel" />)
    .add('Close', () => (
      <HeaderHocHeader title={title} onLeftAction={onAction} leftAction="cancel" leftActionText="Close" />
    ))
    .add('Cancel and Done', () => (
      <HeaderHocHeader
        title={title}
        onLeftAction={onAction}
        leftAction="cancel"
        rightActions={[{label: 'Done', onPress: onAction}]}
      />
    ))
    .add('1 Right Action', () => <HeaderHocHeader title={title} rightActions={rightActions(1)} />)
    .add('2 Right Actions', () => <HeaderHocHeader title={title} rightActions={rightActions(2)} />)
    .add('3 Right Actions', () => <HeaderHocHeader title={title} rightActions={rightActions()} />)
    .add('6 Right Actions', () => <HeaderHocHeader title={title} rightActions={rightActions(6)} />)
    .add('Back and 1 Right Action', () => (
      <HeaderHocHeader title={title} onLeftAction={onAction} rightActions={rightActions(1)} />
    ))
    .add('Back and 2 Right Actions', () => (
      <HeaderHocHeader title={title} onLeftAction={onAction} rightActions={rightActions(2)} />
    ))
    .add('Back and 3 Right Actions', () => (
      <HeaderHocHeader title={title} onLeftAction={onAction} rightActions={rightActions()} />
    ))
    .add('Back and 6 Right Actions', () => (
      <HeaderHocHeader title={title} onLeftAction={onAction} rightActions={rightActions(6)} />
    ))
    .add('Back and 6 Right Actions and Long Title', () => (
      <HeaderHocHeader title={longTitle} onLeftAction={onAction} rightActions={rightActions(6)} />
    ))
    .add('Back and Title Component', () => (
      <HeaderHocHeader titleComponent={titleComponent} onLeftAction={onAction} />
    ))
    .add('Title Component and 1 Right Action', () => (
      <HeaderHocHeader titleComponent={titleComponent} rightActions={rightActions(1)} />
    ))
}

export default load
