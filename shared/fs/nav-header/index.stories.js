// @flow
import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Sb from '../../stories/storybook'
import {commonProvider} from '../common/index.stories'
import Nav2Header from '../../router-v2/header'
import Title from './title-container'
import Actions from './actions'

export const headerProvider = {
  NavHeaderTitle: ({path}: {path: Types.Path}) => ({
    onOpenPath: Sb.action('onOpenPath'),
    path,
  }),
}

const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...headerProvider,
})

const TestWrapper = ({path}) => (
  <Nav2Header
    allowBack={true}
    onPop={Sb.action('onPop')}
    options={{
      headerRightActions: () => <Actions path={path} />,
      headerTitle: () => <Title path={path} />,
    }}
  />
)

export default () =>
  Sb.storiesOf('Files/NavHeaders', module)
    .addDecorator(provider)
    .add('/keybase', () => <TestWrapper path={Types.stringToPath('/keybase')} />)
    .add('/keybase/team', () => <TestWrapper path={Types.stringToPath('/keybase/team')} />)
    .add('/keybase/team/kbkbfstest', () => (
      <TestWrapper path={Types.stringToPath('/keybase/team/kbkbfstest')} />
    ))
    .add('/keybase/team/kbkbfstest/folder', () => (
      <TestWrapper path={Types.stringToPath('/keybase/team/kbkbfstest/folder')} />
    ))
    .add('/keybase/team/kbkbfstest/folder/pic.jpg', () => (
      <TestWrapper path={Types.stringToPath('/keybase/team/kbkbfstest/folder/pic.jpg')} />
    ))
