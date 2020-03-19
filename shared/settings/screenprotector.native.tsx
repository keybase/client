import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import {getSecureFlagSetting, setSecureFlagSetting} from '../native/screenprotector'
import {isAndroid} from '../constants/platform'

type State = {
  secureFlag: boolean
}

class Screenprotector extends React.Component<{}, State> {
  state: State = {secureFlag: false}
  private mounted = false

  componentWillUnmount() {
    this.mounted = false
  }

  componentDidMount() {
    this.mounted = true
    getSecureFlagSetting().then(secureFlag => {
      this.setState({secureFlag})
    })
  }

  _changeSecureFlagOption = (nextValue: boolean) => {
    setSecureFlagSetting(nextValue).then(success => {
      if (success && this.mounted) {
        this.setState({secureFlag: nextValue})
      }
    })
  }

  render() {
    if (!isAndroid) {
      return <Kb.Text type="Body">Screenprotector is only supported on Android</Kb.Text>
    }

    return (
      <Kb.Box style={styles.container}>
        <Kb.Checkbox
          label="Disable App switcher preview and screenshots"
          onCheck={this._changeSecureFlagOption}
          checked={this.state.secureFlag}
        />
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    flex: 1,
    justifyContent: 'flex-start',
    marginLeft: Styles.globalMargins.medium,
    marginRight: Styles.globalMargins.medium,
    marginTop: Styles.globalMargins.medium,
  },
}))

export default Screenprotector
