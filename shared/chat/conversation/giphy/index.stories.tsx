import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import GiphySearch from './index'

const common = {
  previewIsVideo: true,
}
const props = {
  galleryURL: '',
  onClick: (url: string) => Sb.action('onClick')(url),
  previews: [
    {
      ...common,
      previewHeight: 200,
      previewIsVideo: true,
      previewUrl: 'http://media0.giphy.com/media/feqkVgjJpYtjy/200w.mp4',
      previewWidth: 445,
      targetUrl: 'http://gph.is/XJ200y',
    },
    {
      ...common,
      previewHeight: 200,
      previewIsVideo: true,
      previewUrl: 'http://media2.giphy.com/media/FiGiRei2ICzzG/200.mp4',
      previewWidth: 568,
      targetUrl: 'http://gph.is/1fIdLOl',
    },
    {
      ...common,
      previewHeight: 200,
      previewIsVideo: true,
      previewUrl: 'https://media0.giphy.com/media/xUA7b68VhMqQ4Xv8aY/200.mp4',
      previewWidth: 356,
      targetUrl: 'https://gph.is/2ljwmsU',
    },
    {
      ...common,
      previewHeight: 200,
      previewIsVideo: true,
      previewUrl: 'https://media1.giphy.com/media/gSRkSblDEjUuk/200.mp4',
      previewWidth: 263,
      targetUrl: 'https://gph.is/11i7rUS',
    },
    {
      ...common,
      previewHeight: 200,
      previewIsVideo: true,
      previewUrl: 'https://media0.giphy.com/media/26gR0FCswrVMfscRG/200.mp4',
      previewWidth: 379,
      targetUrl: 'https://gph.is/2qld9Fy',
    },
    {
      ...common,
      previewHeight: 200,
      previewIsVideo: true,
      previewUrl: 'https://media0.giphy.com/media/l3fZGF5yOD3YonXPO/200.mp4',
      previewWidth: 266,
      targetUrl: 'https://gph.is/2qwO3GJ',
    },
    {
      ...common,
      previewHeight: 200,
      previewIsVideo: true,
      previewUrl: 'https://media0.giphy.com/media/l0Exk3lvWTWWC1ezS/200.mp4',
      previewWidth: 300,
      targetUrl: 'https://gph.is/2kQz8EU',
    },
    {
      ...common,
      previewHeight: 200,
      previewIsVideo: true,
      previewUrl: 'https://media3.giphy.com/media/3o6Yg6J4RmkJYBFZ9m/200.mp4',
      previewWidth: 356,
      targetUrl: 'https://gph.is/2lBB70Z',
    },
    {
      ...common,
      previewHeight: 200,
      previewIsVideo: true,
      previewUrl: 'https://media1.giphy.com/media/iW20cf1G7xPyg/200.mp4',
      previewWidth: 385,
      targetUrl: 'https://gph.is/1Sz02fi',
    },
    {
      ...common,
      previewHeight: 200,
      previewIsVideo: true,
      previewUrl: 'https://media1.giphy.com/media/l46C8Nl1uHLkppB3G/200.mp4',
      previewWidth: 361,
      targetUrl: 'https://gph.is/2b8qb2r',
    },
  ],
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Giphy', module)
    .addDecorator(story => <Kb.Box style={{maxWidth: 500, padding: 5}}>{story()}</Kb.Box>)
    .add('Display', () => <GiphySearch {...props} />)
}

export default load
