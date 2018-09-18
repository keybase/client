// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import FloatingMenu from '.'

const commonItemProps = {
  onClick: Sb.action('onItemClick'),
}

const commonItems = [
  {...commonItemProps, title: 'One'},
  {...commonItemProps, title: 'Two'},
  {...commonItemProps, title: '3', disabled: true},
  {...commonItemProps, title: 'Four'},
]

const commonProps = {
  onHidden: Sb.action('onHidden'),
  visible: true,
  items: commonItems,
  closeOnSelect: true,
}

const load = () => {
  Sb.storiesOf('Common/FloatingMenu', module)
    .add('Simple', () => <FloatingMenu {...commonProps} />)
    .add('Complex', () => (
      <FloatingMenu
        {...commonProps}
        items={[
          {...commonItemProps, title: 'Open in Finder'},
          {...commonItemProps, title: 'Ignore'},
          'Divider',
          {
            ...commonItemProps,
            title: 'Clear history (3.24 MB)',
            subTitle: 'Deletes old copies of files.',
            danger: true,
          },
          {
            ...commonItemProps,
            title: 'Delete files and clear history (5.17GB)',
            subTitle: 'Deletes everything in this folder, including its backup versions',
            danger: true,
          },
        ]}
      />
    ))
    .add('Not Visible', () => <FloatingMenu {...commonProps} visible={false} />)
}

export default load
