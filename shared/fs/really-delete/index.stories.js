// @flow
import * as Sb from '../../stories/storybook'
import * as Types from '../../constants/types/fs'
import React from 'react'
import ReallyDelete from '.'

const reallyDeleteProps = {
  _deleting: false,
  _onFinishDelete: () => {},
  onBack: Sb.action('onBack'),
  onDelete: Sb.action('onDelete'),
  path: Types.stringToPath('/keybase/private/alice/my_folder'),
  title: 'foo',
}
const load = () => {
  Sb.storiesOf('Files', module).add('Really Delete', () => <ReallyDelete {...reallyDeleteProps} />)
}
export default load
