// @flow
import * as Sb from '../../../../stories/storybook'
import * as Types from '../../../../constants/types/fs'
import React from 'react'
import ConfirmDelete from '.'

const confirmDeleteProps = {
  onBack: Sb.action('onBack'),
  onDelete: Sb.action('onDelete'),
  path: Types.stringToPath('/keybase/private/alice/my_folder'),
  title: 'foo',
}
const load = () => {
  Sb.storiesOf('Files', module).add('ConfirmDelete', () => <ConfirmDelete {...confirmDeleteProps} />)
}
export default load
