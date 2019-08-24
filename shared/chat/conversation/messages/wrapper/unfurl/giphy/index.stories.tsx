import * as React from 'react'
import {Box} from '../../../../../../common-adapters/index'
import * as Sb from '../../../../../../stories/storybook'

import UnfurlGiphy from '.'

const full = {
  faviconURL: require('../../../../../../images/mock/wsj.jpg'),
  imageHeight: 471,
  imageURL: require('../../../../../../images/mock/wsj_image.jpg'),
  imageWidth: 900,
  isCollapsed: false,
  isVideo: false,
  onClose: Sb.action('onClose'),
  onCollapse: Sb.action('onCollapsed'),
}

const noClose = {
  ...full,
  onClose: undefined,
}

const load = () => {
  Sb.storiesOf('Chat/Unfurl/Giphy', module)
    .addDecorator(story => <Box style={{maxWidth: 1000, padding: 5}}>{story()}</Box>)
    .add('Full', () => <UnfurlGiphy {...full} />)
    .add('Full (no close)', () => <UnfurlGiphy {...noClose} />)
}

export default load
