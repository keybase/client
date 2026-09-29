// Chat flows, run in one session by wdio.chat.conf.ts (tests/e2e/run-ios-chat.sh). The composer's
// read-only flow and the data flow's account switch sign the app in as the second account and back.
import './flows/chat-scroll.test'
import './flows/chat-parity.test'
import './flows/chat-composer.test'
import './flows/chat-data.test'
