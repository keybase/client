import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/crypto'
import SubNav from '.'

const load = () => {
  Sb.storiesOf('Crypto/Sub Nav', module)
    .add('Select - Encrypt', () => <SubNav routeSelected={Constants.encryptTab} />)
    .add('Select - Decrypt', () => <SubNav routeSelected={Constants.decryptTab} />)
    .add('Select - Sign', () => <SubNav routeSelected={Constants.signTab} />)
    .add('Select - Verify', () => <SubNav routeSelected={Constants.verifyTab} />)
}

export default load
