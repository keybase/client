// @flow
import React from 'react'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'
import ExportSecretKey from '.'

const load = () => {
  storiesOf('Wallets', module)
    .addDecorator(createPropProvider())
    .add('Export secret key', () => (
      <ExportSecretKey
        onClose={action('onClose')}
        onLoadSecretKey={action('onLoadSecretKey')}
        secretKey="SETECASTRONOMY"
        username="cecileb"
      />
    ))
}

export default load
