import * as React from 'react'
import * as Sb from '../../stories/storybook'
import FloatingMenu from '.'

const commonItemProps = {
  onClick: Sb.action('onItemClick'),
}

const commonItems = [
  {...commonItemProps, title: 'One'},
  {...commonItemProps, title: 'Two'},
  {...commonItemProps, disabled: true, title: '3'},
  {...commonItemProps, title: 'Four'},
  {...commonItemProps, newTag: true, title: 'HasNew'},
]

const commonProps = {
  closeOnSelect: true,
  items: commonItems,
  onHidden: Sb.action('onHidden'),
  visible: true,
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
            danger: true,
            subTitle: 'Deletes old copies of files.',
            title: 'Clear history (3.24 MB)',
          },
          {
            ...commonItemProps,
            danger: true,
            subTitle: 'Deletes everything in this folder, including its backup versions',
            title: 'Delete files and clear history (5.17GB)',
          },
        ]}
      />
    ))
    .add('Not Visible', () => <FloatingMenu {...commonProps} visible={false} />)
}

export default load
