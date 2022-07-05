import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import Folders from './index'

const commonProps = {
  openInFilesTab: Sb.action('openInFilesTab'),
  style: {maxWidth: 256},
}

const load = () =>
  Sb.storiesOf('Profile', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Folders', () => (
      <Kb.Box2 direction="vertical">
        <Kb.Text type="Header">4 items</Kb.Text>
        <Folders
          tlfs={[
            {...commonProps, isPublic: true, isSelf: true, text: `public/meatball`},
            {...commonProps, isPublic: true, isSelf: false, text: `public/meatball,songgao`},
            {...commonProps, isPublic: false, isSelf: true, text: `private/meatball`},
            {...commonProps, isPublic: false, isSelf: false, text: `private/meatball,songgao`},
          ]}
          loadTlfs={Sb.action('loadTlfs')}
        />
        <Kb.Text type="Header">more items</Kb.Text>
        <Folders
          tlfs={[
            {...commonProps, isPublic: true, isSelf: true, text: `public/meatball`},
            {...commonProps, isPublic: true, isSelf: false, text: `public/meatball,songgao`},
            {...commonProps, isPublic: false, isSelf: true, text: `private/meatball`},
            {...commonProps, isPublic: false, isSelf: false, text: `private/meatball,songgao`},
            {...commonProps, isPublic: false, isSelf: false, text: `private/meatball,songgao,petco`},
          ]}
          loadTlfs={Sb.action('loadTlfs')}
        />
      </Kb.Box2>
    ))

export default load
