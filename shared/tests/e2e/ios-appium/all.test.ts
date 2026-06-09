// Single aggregate spec: wdio creates one session per spec FILE, so importing
// every flow here (side-effect imports register their describe/it blocks) runs
// the whole suite in ONE session — no per-file session teardown/recreate (~800ms
// each) and the app stays warm between flows.
import './flows/chat-conversation.test'
import './flows/chat-send-message.test'
import './flows/crypto-outputs.test'
import './flows/crypto-subtabs.test'
import './flows/device-detail.test'
import './flows/devices-view.test'
import './flows/files-browse.test'
import './flows/files-folders.test'
import './flows/git.test'
import './flows/people-profile.test'
import './flows/settings-navigation.test'
import './flows/settings-subpages.test'
import './flows/team-member.test'
import './flows/teams-browse.test'
import './flows/teams-inner.test'
