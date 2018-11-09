// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/wallets'
import * as Styles from '../../../../styles'
import type {Props} from './index.types'

const makePickerItems = (currencies: I.List<Types.Currency>) =>
  currencies.map(c => ({label: c.description, value: c.code})).toArray()

const Prompt = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.promptContainer}>
    <Kb.Text type="BodySmallSemibold" style={styles.textAlignCenter}>
      Pick a display currency
    </Kb.Text>
    <Kb.Text type="BodySmall" style={styles.textAlignCenter}>
      Past transactions won’t be affected by this change.
    </Kb.Text>
  </Kb.Box2>
)

type State = {selected: Types.CurrencyCode, showingMenu: boolean, showingToast: boolean}
class DisplayCurrencyDropdown extends React.Component<Props, State> {
  state = {selected: this.props.selected.code, showingMenu: false, showingToast: false}
  _toggleShowingMenu = () =>
    this.setState(s => ({
      showingMenu: !s.showingMenu,
    }))
  _onDone = () => {
    this.props.onCurrencyChange(this.state.selected)
    this.setState({showingMenu: false})
  }
  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.props.selected.code === this.state.selected && prevProps.selected.code !== this.state.selected) {
      this.setState({showingToast: true})
      setTimeout(() => this.setState({showingToast: false}), 1000)
    } else if (this.props.selected.code !== prevProps.selected.code) {
      this.setState({selected: this.props.selected.code})
    }
  }
  render() {
    return (
      <>
        <Kb.DropdownButton
          disabled={this.props.waiting}
          selected={
            <Kb.Text type="BodyBig" style={styles.textAlignCenter}>
              {this.props.selected.description}
            </Kb.Text>
          }
          toggleOpen={this._toggleShowingMenu}
        />
        <Kb.FloatingPicker
          items={makePickerItems(this.props.currencies)}
          selectedValue={this.state.selected}
          onSelect={selected => this.setState({selected})}
          prompt={<Prompt />}
          onHidden={this._toggleShowingMenu}
          onCancel={this._toggleShowingMenu}
          onDone={this._onDone}
          visible={this.state.showingMenu}
        />
        <Kb.Toast visible={this.state.showingToast}>
          <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
            <Kb.Icon type="iconfont-check" color={Styles.globalColors.white} fontSize={22} />
            <Kb.Text type="BodySemibold" style={styles.toastText}>
              Saved
            </Kb.Text>
          </Kb.Box2>
        </Kb.Toast>
      </>
    )
  }
}

const styles = Styles.styleSheetCreate({
  promptContainer: {
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
  textAlignCenter: {
    textAlign: 'center',
  },
  toastText: {
    color: Styles.globalColors.white,
  },
})

export default DisplayCurrencyDropdown
