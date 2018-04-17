// @flow
import avatar from '../common-adapters/avatar.stories'
import meta from '../common-adapters/meta.stories'
import buttonBar from '../common-adapters/button-bar.stories'
import button from '../common-adapters/button.stories'
import box from '../common-adapters/box.stories'
import chatSendAnimation from '../chat/conversation/messages/wrapper/chat-send.stories'
import chatInboxRow from '../chat/inbox/row/index.stories'
import chatInfoPanel from '../chat/conversation/info-panel/index.stories'
import chatInfoPanelNotifications from '../chat/conversation/info-panel/notifications/index.stories'
// import chatList from '../chat/conversation/list/index.stories'
import chatCreateChannel from '../chat/create-channel/index.stories'
import chatManageChannels from '../chat/manage-channels/index.stories'
import chatChannelMentionHud from '../chat/conversation/input-area/channel-mention-hud/index.stories'
import chatUserMentionHud from '../chat/conversation/input-area/user-mention-hud/index.stories'
import checkbox from '../common-adapters/checkbox.stories'
import devices from '../devices/index.stories'
import dropdown from '../common-adapters/dropdown.stories'
import formWithCheckbox from '../common-adapters/form-with-checkbox.stories'
import fs from '../fs/index.stories.js'
import git from '../git/index.stories'
import icon from '../common-adapters/icon.stories'
import input from '../common-adapters/input.stories'
import login from '../login/index.stories'
import nameWithIcon from '../common-adapters/name-with-icon.stories'
import radiobutton from '../common-adapters/radio-button.stories'
import retention from '../teams/team/settings-tab/retention/index.stories'
import roles from '../teams/role-picker/index.stories'
import saveIndicator from '../common-adapters/save-indicator.stories'
import search from '../search/search.stories'
import teams from '../teams/index.stories'
import text from '../common-adapters/text.stories'
import editTeamDescription from '../teams/edit-team-description/index.stories'
import peopleTask from '../people/task/index.stories'
import peopleFollowNotification from '../people/follow-notification/index.stories'
import peopleFollowSuggestions from '../people/follow-suggestions/index.stories'

const stories = {
  avatar,
  box,
  button,
  buttonBar,
  chatChannelMentionHud,
  chatCreateChannel,
  chatSendAnimation,
  chatInboxRow,
  chatInfoPanel,
  chatInfoPanelNotifications,
  // chatList,
  chatManageChannels,
  chatUserMentionHud,
  checkbox,
  devices,
  dropdown,
  editTeamDescription,
  formWithCheckbox,
  fs,
  git,
  icon,
  input,
  login,
  meta,
  nameWithIcon,
  peopleTask,
  peopleFollowNotification,
  peopleFollowSuggestions,
  radiobutton,
  retention,
  roles,
  saveIndicator,
  search,
  teams,
  text,
}

export default stories
