import React, {Component} from 'react'
import {globalStyles, globalMargins} from '../styles'
import {Box, Text, Checkbox, HeaderHoc} from '../common-adapters'
import {getSecureFlagSetting, setSecureFlagSetting} from '../native/screenprotector'
import {isAndroid} from '../constants/platform'

type State = {
  secureFlag: boolean
}

class Screenprotector extends Component<{}, State> {
  state: State = {secureFlag: false}
  mounted = false

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
      return <Text type="Body">Screenprotector is only supported on Android</Text>
    }

    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'stretch',
          flex: 1,
          justifyContent: 'flex-start',
          marginLeft: globalMargins.medium,
          marginRight: globalMargins.medium,
          marginTop: globalMargins.medium,
        }}
      >
        <Checkbox
          label="Disable App switcher preview and screenshots"
          onCheck={this._changeSecureFlagOption}
          checked={this.state.secureFlag}
        />
      </Box>
    )
  }
}

export default HeaderHoc(Screenprotector)
