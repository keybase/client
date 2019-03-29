// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ConfirmModal from './index'

const props = {
  description: 'Description - Explain here what are the consequences of tapping the Confirm button.',
  icon: 'iconfont-keybase',
  onCancel: Sb.action('onCancel'),
  onConfirm: Sb.action('onConfirm'),
  prompt: 'Are you sure…? (can go on 2 lines)',
}

const confirmTextProps = {
  ...props,
  confirmText: 'Yes, delete',
}

const load = () => {
  Sb.storiesOf('Common/Confirm Modal', module).add('Confirm', () => <ConfirmModal {...props} />)
  Sb.storiesOf('Common/Confirm Modal', module).add('Confirm Text', () => (
    <ConfirmModal {...confirmTextProps} />
  ))
}

export default load
