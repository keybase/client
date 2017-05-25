// @flow
import OldProfileResetNotice from './old-profile-reset-notice'
import ProfileResetNotice from './profile-reset-notice'
import FollowNotice from './follow-notice'
import UnfollowNotice from './unfollow-notice'

const baseMock = {
  username: 'jzila',
  parentProps: {
    style: {
      width: 480,
    },
  },
}

const oldProfileResetNoticeMap = {
  component: OldProfileResetNotice,
  mocks: {
    Normal: {
      ...baseMock,
      onOpenNewerConversation: () => console.log('onOpenNewerConversation'),
    },
  },
}

const profileResetNoticeMap = {
  component: ProfileResetNotice,
  mocks: {
    Normal: {
      ...baseMock,
      onOpenOlderConversation: () => console.log('onOpenOlderConversation'),
    },
  },
}

const followNoticeMap = {
  component: FollowNotice,
  mocks: {
    Normal: baseMock,
  },
}

const unfollowNoticeMap = {
  component: UnfollowNotice,
  mocks: {
    Normal: baseMock,
  },
}

export default {
  'Old Profile Reset Notice': oldProfileResetNoticeMap,
  'Profile Reset Notice': profileResetNoticeMap,
  'Follow Notice': followNoticeMap,
  'Unfollow Notice': unfollowNoticeMap,
}
