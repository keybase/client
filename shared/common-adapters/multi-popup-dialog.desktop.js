// @flow
import * as React from 'react'
import type {Props, ChildKey, Context} from './multi-popup-dialog'
import PopupDialog from './popup-dialog'
import Box from './box'
import * as Styles from '../styles'

type State = {
  history: Array<ChildKey>, // does not include `current`
  current: ChildKey,
}

const {Provider, Consumer} = React.createContext(
  ({
    multiPopupDialogAppend: () => {},
    multiPopupDialogBack: () => {},
  }: Context)
)

class Dialog extends React.PureComponent<Props, State> {
  state = {
    history: [],
    current: this.props.initialChildKey,
  }
  getContext = (history: Array<ChildKey>, current: ChildKey): Context => ({
    multiPopupDialogAppend: (key: ChildKey) =>
      this.setState(() => ({
        history: [...history, current],
        current: key,
      })),
    multiPopupDialogBack: () =>
      this.setState(state => ({
        history: history.slice(0, -1),
        current: history[history.length - 1] || this.props.initialChildKey,
      })),
  })
  render() {
    return (
      <PopupDialog {...this.props}>
        {[
          ...this.state.history.map((current: ChildKey, i, allHistory) => {
            const history = allHistory.slice(0, i) // history as perceived by this component
            return (
              <Provider value={this.getContext(history, current)} key={current}>
                <Box style={styles.hidden}>{this.props.childrenMap.get(current)}</Box>
              </Provider>
            )
          }),
          <Provider value={this.getContext(this.state.history, this.state.current)} key={this.state.current}>
            <Box>{this.props.childrenMap.get(this.state.current)}</Box>
          </Provider>,
        ]}
      </PopupDialog>
    )
  }
}

const styles = Styles.styleSheetCreate({
  hidden: Styles.platformStyles({
    isElectron: {
      display: 'none',
    },
  }),
})

export {Consumer, Dialog}
