// @flow
import * as React from 'react'
import FloatingMenu from '.'
import {storiesOf, createPropProvider, action} from '../../stories/storybook'
import * as PropProviders from '../../stories/prop-providers'

const provider = createPropProvider(PropProviders.Common())

const commonItemProps = {
  onClick: action('onItemClick'),
}

const commonItems = [
  {...commonItemProps, title: 'One'},
  {...commonItemProps, title: 'Two'},
  {...commonItemProps, title: '3', disabled: true},
  {...commonItemProps, title: 'Four'},
]

const commonProps = {
  onHidden: action('onHidden'),
  visible: true,
  items: commonItems,
}

const load = () => {
  storiesOf('Common/FloatingMenu', module)
    .addDecorator(provider)
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
