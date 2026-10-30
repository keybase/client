// The release gate's flows, in one session (see all.test.ts). The gate hooks come first so they wrap
// every flow's tests.
import './gate/hooks'
import './flows/harness-helpers.test'
import './flows/devices-view.test'
import './flows/device-detail.test'
import './flows/device-paper-key.test'
import './flows/device-revoke.test'
import './flows/device-provision.test'
