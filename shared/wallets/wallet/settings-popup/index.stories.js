// // @flow
// import * as React from 'react'
// import * as Sb from '../../../stories/storybook'
// import {SettingsPopup} from '.'
// import confirmDefaultAccount from './set-default/index.stories'

// const defaultSettingsProps = {
//   name: 'awesome account',
//   user: 'testuser',
//   isDefault: true,
//   currency: 'USD ($)',
//   currencies: ['USD ($)', 'XLM', 'CAD ($)', 'EUR (€)', 'GBP (£)'],
//   onDelete: Sb.action('onDelete'),
//   onSetDefault: Sb.action('setDefault'),
//   onEditName: Sb.action('onEditName'),
//   onCurrencyChange: Sb.action('onCurrencyChange'),
// }

// const secondarySettingsProps = {
//   name: 'some other account',
//   user: 'testuser',
//   isDefault: false,
//   currency: 'XLM',
//   currencies: ['USD ($)', 'XLM', 'CAD ($)', 'EUR (€)', 'GBP (£)'],
//   onDelete: Sb.action('onDelete'),
//   onSetDefault: Sb.action('setDefault'),
//   onEditName: Sb.action('onEditName'),
//   onCurrencyChange: Sb.action('onCurrencyChange'),
// }

// const load = () => {
//   Sb.storiesOf('Wallets/Wallet/Settings', module)
//     .add('Default', () => <SettingsPopup {...defaultSettingsProps} />)
//     .add('Secondary', () => <SettingsPopup {...secondarySettingsProps} />)
//   confirmDefaultAccount()
// }

// export default load
