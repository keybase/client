import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

const commasToPeriods = s => s.replace(/,/, '.')

const isValidAmount = (amt, numDecimalsAllowed) => {
  if (!isNaN(Number(amt)) || amt === '.') {
    if (amt && amt.startsWith && amt.startsWith('-')) {
      return false
    }
    // This is a valid number. Now check the number of decimal places
    const split = amt.split('.')
    if (split.length === 1) {
      // no decimal places
      return true
    }
    const decimal = split[split.length - 1]
    if (decimal.length <= numDecimalsAllowed) {
      return true
    }
  }
  return false
}

const truncateAmount = (amt, numDecimalsAllowed) => {
  const num = Number(amt)
  return num.toFixed(numDecimalsAllowed)
}

const placeholder = {}
const getPlaceHolder = (numDecimalsAllowed: number) => {
  if (!placeholder[numDecimalsAllowed]) {
    placeholder[numDecimalsAllowed] = `0.${'0'.repeat(numDecimalsAllowed)}`
  }
  return placeholder[numDecimalsAllowed]
}

type AmountInputProps = {
  error?: boolean
  numDecimalsAllowed: number
  onChangeAmount: (amount: string) => void
  rightBlock?: 'loading' | React.ReactNode
  value: string
}

export const AmountInput = (props: AmountInputProps) => {
  const {numDecimalsAllowed, onChangeAmount, value} = props
  const _onChangeAmount = React.useCallback(
    t => {
      // we treat commas and periods as the decimal separator, converted to
      // periods throughout the send form
      const tNormalized = commasToPeriods(t)
      isValidAmount(tNormalized, numDecimalsAllowed) && onChangeAmount(tNormalized)
    },
    [numDecimalsAllowed, onChangeAmount]
  )
  React.useEffect(() => {
    if (isValidAmount(value, numDecimalsAllowed)) {
      return
    }
    const truncated = truncateAmount(value, numDecimalsAllowed)
    isValidAmount(truncated, numDecimalsAllowed) && onChangeAmount(truncated)
  }, [numDecimalsAllowed, onChangeAmount, value])
  return (
    <Kb.NewInput
      autoFocus={true}
      type="text"
      keyboardType="numeric"
      decoration={
        props.rightBlock === 'loading' ? (
          <Kb.ProgressIndicator style={sharedStyles.currencyContainer} />
        ) : (
          props.rightBlock
        )
      }
      containerStyle={styles.inputContainer}
      style={styles.input}
      onChangeText={_onChangeAmount}
      textType="HeaderBigExtrabold"
      placeholder={getPlaceHolder(props.numDecimalsAllowed)}
      placeholderColor={Styles.globalColors.purple_40}
      error={!!props.error}
      value={props.value}
    />
  )
}

const styles = Styles.styleSheetCreate({
  input: Styles.platformStyles({
    common: {
      color: Styles.globalColors.purple,
      position: 'relative',
    },
    isElectron: {
      height: '1em',
    },
  }),
  inputContainer: {
    alignItems: 'flex-start',
    borderWidth: 0,
    paddingLeft: 0,
    paddingTop: 0,
  },
})

export const sharedStyles = Styles.styleSheetCreate({
  container: {
    alignItems: 'flex-start',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  currencyContainer: Styles.platformStyles({
    common: {
      alignItems: 'flex-end',
    },
    isElectron: {
      height: 44,
    },
    isMobile: {
      height: 52,
    },
  }),
  purple: {
    color: Styles.globalColors.purpleDark,
  },
})
