import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/wallets'
import * as Styles from '../../../../styles'
import {Props} from '.'

const makePickerItems = (currencies: Array<Types.Currency>) =>
  currencies.map(c => ({label: c.description, value: c.code}))

const Prompt = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.promptContainer}>
    <Kb.Text center={true} type="BodySmallSemibold">
      Pick a display currency
    </Kb.Text>
    <Kb.Text center={true} type="BodySmall">
      Past transactions won’t be affected by this change.
    </Kb.Text>
  </Kb.Box2>
)

const DisplayCurrencyDropdown = (props: Props) => {
  const selectedFromProps = props.selected.code
  const [selected, setSelected] = React.useState(selectedFromProps)
  const [showingMenu, setShowingMenu] = React.useState(false)
  const [showingToast, setShowingToast] = React.useState(false)
  const onceRef = React.useRef(false)
  const setShowingToastFalseLater = Kb.useTimeout(() => setShowingToast(false), 1000)

  React.useEffect(() => {
    const justSaved = selectedFromProps === selected && onceRef.current
    if (justSaved) {
      setShowingToast(true)
      setShowingToastFalseLater()
    }
    onceRef.current = true
  }, [selected, selectedFromProps, onceRef, setShowingToast, setShowingToastFalseLater])

  React.useEffect(() => {
    setSelected(selectedFromProps)
  }, [selectedFromProps])

  const onDone = () => {
    props.onCurrencyChange(selected)
    setShowingMenu(false)
  }
  const onClose = () => {
    setShowingMenu(false)
    setSelected(props.selected.code)
  }
  const toggleShowingMenu = () => setShowingMenu(s => !s)
  return (
    <>
      <Kb.DropdownButton
        disabled={props.waiting}
        selected={
          props.selected.description && !props.waiting ? (
            <Kb.Text type="BodyBig" style={styles.selectedText}>
              {props.selected.description}
            </Kb.Text>
          ) : (
            <Kb.ProgressIndicator type="Small" style={styles.progressIndicator} />
          )
        }
        style={styles.dropdown}
        toggleOpen={toggleShowingMenu}
      />
      <Kb.FloatingPicker
        items={makePickerItems(props.currencies)}
        selectedValue={selected}
        onSelect={setSelected}
        prompt={<Prompt />}
        promptString="Pick a display currency"
        onHidden={onClose}
        onCancel={onClose}
        onDone={onDone}
        visible={showingMenu}
      />
      <Kb.SimpleToast iconType="iconfont-check" text="Saved" visible={showingToast} />
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  dropdown: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
    },
    isElectron: {
      ...Styles.globalStyles.fullWidth,
    },
  }),
  progressIndicator: {
    height: 22,
    width: 22,
  },
  promptContainer: {
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
  selectedText: {
    paddingLeft: Styles.globalMargins.xsmall,
    width: '100%',
  },
  toastText: {color: Styles.globalColors.white},
}))

export default DisplayCurrencyDropdown
