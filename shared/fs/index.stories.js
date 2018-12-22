// @flow
import rowStories from './row/index.stories'
import commonStories from './common/index.stories'
import footerStories from './footer/index.stories'
import sendLinkToChatStories from './send-link-to-chat/index.stories'
import destinationPickerStories from './destination-picker/index.stories'
import folderStories from './folder/index.stories'
import oopsNoAccessStories from './oops-no-access/index.stories'

export default () =>
  [
    folderStories,
    commonStories,
    rowStories,
    footerStories,
    destinationPickerStories,
    sendLinkToChatStories,
    oopsNoAccessStories,
  ].forEach(l => l())
