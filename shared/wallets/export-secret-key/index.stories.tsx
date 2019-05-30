import React from 'react'
import * as Sb from '../../stories/storybook'
import ExportSecretKey from '.'
import {stringToAccountID} from '../../constants/types/wallets'

const props = {
  accountID: stringToAccountID('GBCCH4KHE5MUXXYSFCKJ3BRN4U3MTXOXD2GBJH5V7QF6OJ6S5R23DWYF'),
  accountName: 'Money for Sneakers',
  onClose: Sb.action('onClose'),
  onLoadSecretKey: Sb.action('onLoadSecretKey'),
  onSecretKeySeen: Sb.action('onSecretKeySeen'),
  username: 'cecileb',
}

const load = () => {
  Sb.storiesOf('Wallets', module)
    .add('Export secret key', () => <ExportSecretKey {...props} secretKey="SETECASTRONOMY" />)
    .add('Export secret key (loading)', () => <ExportSecretKey {...props} secretKey="" />)
}

export default load
