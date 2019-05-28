import * as I from 'immutable'
import * as Types from '../../../../constants/types/wallets'

export type Props = {
  currencies: I.List<Types.Currency>
  onCurrencyChange: (arg0: Types.CurrencyCode) => void
  saveCurrencyWaiting: boolean
  selected: Types.Currency
  waiting: boolean
}
