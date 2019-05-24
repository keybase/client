// @flow
import bannerStories from './banner/index.stories'
import commonStories from './common/index.stories'
import destinationPickerStories from './folder/destination-picker/index.stories'
import filepreviewStories from './filepreview/index.stories'
import folderStories from './folder/index.stories'
import footerStories from './footer/index.stories'
import navHeaderStories from './nav-header/index.stories'
import oopsStories from './oops/index.stories'
import topBarStories from './top-bar/index.stories'
import rowStories from './folder/rows/index.stories'
import sendAttachmentToChatStories from './send-to-chat/attachment/index.stories'
import sendLinkToChatStories from './send-to-chat/link/index.stories'
import confirmDeleteStories from './common/path-item-action/confirm-delete/index.stories'
export default () =>
  [
    bannerStories,
    commonStories,
    destinationPickerStories,
    filepreviewStories,
    folderStories,
    footerStories,
    navHeaderStories,
    oopsStories,
    confirmDeleteStories,
    topBarStories,
    rowStories,
    sendAttachmentToChatStories,
    sendLinkToChatStories,
  ].forEach(l => l())
