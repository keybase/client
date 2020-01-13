import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Constants from '../../../constants/crypto'
import * as Types from '../../../constants/types/crypto'
import OperationRow from './container'

const onSelect = Sb.action('onSelect')

const provider = Sb.createPropProvider({
  OperationRow: props => ({
    isSelected: props.isSelected || false,
    onSelect: () => onSelect(props.tab),
    tab: props.tab,
    title: props.title,
  }),
})

const load = () => {
  Sb.storiesOf('Crypto', module)
    .addDecorator(provider)
    .add('Operation Row', () =>
      Constants.Tabs.map(row => (
        <OperationRow
          key={row.tab}
          isSelected={false}
          title={row.title}
          tab={row.tab as Types.CryptoSubTab}
          icon={row.icon}
        />
      ))
    )
}

export default load
