// The `keybase` CLI every e2e call runs: the one built from this checkout, or KB_CLI. The account
// guard (requireMainIsSmoke) asks this same binary, so what it checked is what the calls act on.
import * as os from 'os'
import * as path from 'path'

export const keybaseBin = () => process.env['KB_CLI'] ?? path.join(os.homedir(), 'go', 'bin', 'keybase')
