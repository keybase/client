// Starts the e2e peer services (second, owner) the way the release gates' preflight does. A targeted
// run doesn't start them, and every flow that needs a second account fails without them.
// Run from shared/: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON ../skill/running-e2e-release-gates/start-peers.mts
import {loadE2EEnv, peerRoles} from '../../shared/tests/e2e/accounts/env.ts'
import {ensurePeer} from '../../shared/tests/e2e/shared/peer-service.ts'

const env = loadE2EEnv()
for (const role of peerRoles) {
  await ensurePeer(role, env)
  console.log(`peer up: ${role}`)
}
