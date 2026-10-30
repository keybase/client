// Chat flows, run in one session by wdio.chat.conf.ts (tests/e2e/run-ios-chat.sh). The data flow's
// account switch signs the app in as the second account and back.
import './flows/chat-parity.test'
import './flows/chat-data.test'
