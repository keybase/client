// @flow
import React from 'react'
import * as Sb from '../../stories/storybook'
import ExportSecretKey from '.'

const load = () => {
  Sb.storiesOf('Wallets', module).add('Export secret key', () => (
    <ExportSecretKey
      onClose={Sb.action('onClose')}
      onLoadSecretKey={Sb.action('onLoadSecretKey')}
      secretKey="SETECASTRONOMY"
      username="cecileb"
    />
  ))
}

export default load
