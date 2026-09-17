// App lifecycle flows, run in one session by wdio.lifecycle.conf.ts. Live location runs
// last: the map posts it makes fail on the maps server and retry from the outbox for up to
// fifteen minutes, which keeps background task windows open for the flows after it.
import './flows/lifecycle-app-state.test'
import './flows/lifecycle-links-push.test'
import './flows/lifecycle-location.test'
