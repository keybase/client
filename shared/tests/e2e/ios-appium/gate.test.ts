// The release gate's flows, in one session. The gate hooks come first so they wrap
// every flow's tests.
import './gate/hooks'
import './flows/harness-helpers.test'
// app-level: deep links, pushes and the app's lifecycle
import './flows/app-deep-links.test'
import './flows/app-push.test'
import './flows/app-lifecycle.test'
import './flows/devices-view.test'
import './flows/device-detail.test'
import './flows/device-paper-key.test'
import './flows/device-provision.test'
import './flows/account-switch.test'
import './flows/account-login.test'
import './flows/account-signed-out.test'
import './flows/chat-scroll.test'
import './flows/chat-composer.test'
import './flows/chat-data.test'
import './flows/chat-parity.test'
import './flows/chat-attachments.test'
import './flows/chat-messages.test'
import './flows/chat-conversations.test'
import './flows/chat-channel-settings.test'
import './flows/chat-bots.test'
import './flows/chat-unfurl.test'
import './flows/chat-views.test'
// last of the chat flows: a block it fails to put back stops no other chat flow of the run
import './flows/chat-blocks.test'
// shares from Photos, Safari, Files and Maps through the share extension, and an image paste
import './flows/share-extension.test'
import './flows/files-browse.test'
import './flows/files-actions.test'
import './flows/files-previews.test'
import './flows/files-settings.test'
import './flows/teams-browse.test'
import './flows/teams-subteams.test'
import './flows/teams-members.test'
import './flows/teams-settings.test'
// the system photo and document pickers: uploads to chat and Files, a team avatar and custom emoji
import './flows/chat-attachments-picker.test'
import './flows/files-upload.test'
import './flows/teams-avatar-emoji.test'
// changes and puts back the phone's photo permissions (each change relaunches the app)
import './flows/files-save-photos.test'
import './flows/git.test'
// after the other second-account flows, as chat-blocks is
import './flows/teams-second.test'
// after the chat flows: a follow adds a link to the smoke account's sigchain, and a peer send right
// after it can fail until the server's chain catches up
import './flows/people-browse.test'
import './flows/people-follow.test'
import './flows/profile-edit.test'
import './flows/profile-avatar.test'
import './flows/crypto.test'
import './flows/crypto-roundtrip.test'
import './flows/settings-account.test'
// after the chat unfurl flow, which keeps the account's link preview settings in a file of its own
// while it runs; it relaunches the app, as smoke
import './flows/settings-persisted.test'
import './flows/settings-archive.test'
import './flows/settings-subpages.test'
import './flows/settings-debug-pages.test'
// the second account's proofs add links to its sigchain; after its other flows
import './flows/profile-proofs.test'
// relaunches with the second account signed out part way, so after the other second-account flows
import './flows/settings-remember-password.test'
// last: it changes the second account's password, and a change that stops part way leaves it to the
// owner (no later flow could sign the second account in)
import './flows/settings-password.test'
// last: a location post the maps server fails retries from the outbox for up to 15 minutes (until
// its channel is deleted), and its restores put back the phone's location permission
import './flows/chat-location.test'
