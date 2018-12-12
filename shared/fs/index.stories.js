// @flow
import folderStories from './folder/index.stories'
import rowStories from './row/index.stories'
import commonStories from './common/index.stories'
import footerStories from './footer/index.stories'
import destinationPickerStories from './destination-picker/index.stories'

export default () =>
  [folderStories, commonStories, rowStories, footerStories, destinationPickerStories].forEach(l => l())
