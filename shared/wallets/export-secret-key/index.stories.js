// @flow
import React from 'react'
import * as Sb from '../../stories/storybook'
import ExportSecretKey from '.'
import {stringToAccountID} from '../../constants/types/wallets'

const load = () => {
  Sb.storiesOf('Wallets', module).add('Export secret key', () => (
    <ExportSecretKey
      accountID={stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF')}
      accountName="Money for Sneakers"
      onClose={Sb.action('onClose')}
      onLoadSecretKey={Sb.action('onLoadSecretKey')}
      secretKey="SETECASTRONOMY"
      username="cecileb"
    />
  ))
}

export default load
