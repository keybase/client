// @flow
import bannerStories from './banner/index.stories'
import commonStories from './common/index.stories'
import destinationPickerStories from './destination-picker/index.stories'
import filepreviewStories from './filepreview/index.stories'
import folderStories from './folder/index.stories'
import footerStories from './footer/index.stories'
import headerStories from './header/index.stories'
import navHeaderStories from './nav-header/index.stories'
import oopsStories from './oops/index.stories'
import topBarStories from './top-bar/index.stories'
import rowStories from './row/index.stories'
import sendAttachmentToChatStories from './send-attachment-to-chat/index.stories'
import sendLinkToChatStories from './send-link-to-chat/index.stories'

export default () =>
  [
    bannerStories,
    commonStories,
    destinationPickerStories,
    filepreviewStories,
    folderStories,
    footerStories,
    headerStories,
    navHeaderStories,
    oopsStories,
    topBarStories,
    rowStories,
    sendAttachmentToChatStories,
    sendLinkToChatStories,
  ].forEach(l => l())
