// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Sb from '../../../stories/storybook'
import GiphySearch from '.'

const common = {
  previewIsVideo: true,
}
const props = {
  onClick: (url: string) => Sb.action('onClick')(url),
  previews: [
    {
      ...common,
      targetUrl: 'http://gph.is/XJ200y',
      previewUrl: 'http://media0.giphy.com/media/feqkVgjJpYtjy/200w.mp4',
      previewIsVideo: true,
      previewWidth: 445,
      previewHeight: 200,
    },
    {
      ...common,
      targetUrl: 'http://gph.is/1fIdLOl',
      previewUrl: 'http://media2.giphy.com/media/FiGiRei2ICzzG/200.mp4',
      previewIsVideo: true,
      previewWidth: 568,
      previewHeight: 200,
    },
    {
      ...common,
      targetUrl: 'https://gph.is/2ljwmsU',
      previewUrl: 'https://media0.giphy.com/media/xUA7b68VhMqQ4Xv8aY/200.mp4',
      previewIsVideo: true,
      previewWidth: 356,
      previewHeight: 200,
    },
    {
      ...common,
      targetUrl: 'https://gph.is/11i7rUS',
      previewUrl: 'https://media1.giphy.com/media/gSRkSblDEjUuk/200.mp4',
      previewIsVideo: true,
      previewWidth: 263,
      previewHeight: 200,
    },
    {
      ...common,
      targetUrl: 'https://gph.is/2qld9Fy',
      previewUrl: 'https://media0.giphy.com/media/26gR0FCswrVMfscRG/200.mp4',
      previewIsVideo: true,
      previewWidth: 379,
      previewHeight: 200,
    },
    {
      ...common,
      targetUrl: 'https://gph.is/2qwO3GJ',
      previewUrl: 'https://media0.giphy.com/media/l3fZGF5yOD3YonXPO/200.mp4',
      previewIsVideo: true,
      previewWidth: 266,
      previewHeight: 200,
    },
    {
      ...common,
      targetUrl: 'https://gph.is/2kQz8EU',
      previewUrl: 'https://media0.giphy.com/media/l0Exk3lvWTWWC1ezS/200.mp4',
      previewIsVideo: true,
      previewWidth: 300,
      previewHeight: 200,
    },
    {
      ...common,
      targetUrl: 'https://gph.is/2lBB70Z',
      previewUrl: 'https://media3.giphy.com/media/3o6Yg6J4RmkJYBFZ9m/200.mp4',
      previewIsVideo: true,
      previewWidth: 356,
      previewHeight: 200,
    },
    {
      ...common,
      targetUrl: 'https://gph.is/1Sz02fi',
      previewUrl: 'https://media1.giphy.com/media/iW20cf1G7xPyg/200.mp4',
      previewIsVideo: true,
      previewWidth: 385,
      previewHeight: 200,
    },
    {
      ...common,
      targetUrl: 'https://gph.is/2b8qb2r',
      previewUrl: 'https://media1.giphy.com/media/l46C8Nl1uHLkppB3G/200.mp4',
      previewIsVideo: true,
      previewWidth: 361,
      previewHeight: 200,
    },
  ],
}

const load = () => {
  Sb.storiesOf('Chat/Giphy', module)
    .addDecorator(story => <Kb.Box style={{maxWidth: 500, padding: 5}}>{story()}</Kb.Box>)
    .add('Display', () => <GiphySearch {...props} />)
}

export default load
