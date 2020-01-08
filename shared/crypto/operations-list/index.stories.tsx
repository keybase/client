import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Constants from '../../constants/crypto'
// import * as Types from '../../constants/types/crypto'
import OperationsList from '.'

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
  Sb.storiesOf('Crypto/Operations List', module)
    .addDecorator(provider)
    .add('Default', () => <OperationsList routeSelected={Constants.encryptTab} />)
}

export default load
