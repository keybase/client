// @flow

import React, {Component} from 'react'
import {globalStyles} from '../styles'
import {Box, Icon, Text, Checkbox} from '../common-adapters'
import {getSecureFlagSetting, setSecureFlagSetting} from '../native/screenprotector'
import {isAndroid} from '../constants/platform'

type State = {
  secureFlag: boolean,
}

class Screenprotector extends Component {
  state: State = {secureFlag: false}
  mounted = false

  componentWillMount () {
    getSecureFlagSetting().then(secureFlag => {
      this.setState({secureFlag})
    })
  }

  componentWillUnmount () {
    this.mounted = false
  }

  componentDidMount () {
    this.mounted = true
  }

  _changeSecureFlagOption = (nextValue: boolean) => {
    setSecureFlagSetting(nextValue).then(success => {
      if (success && this.mounted) {
        this.setState({secureFlag: nextValue})
      }
    })
  }

  render () {
    if (!isAndroid) {
      return <Text type='Body'>Screenprotector is only supported on android</Text>
    }

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Icon type='icon-keybase-logo-128' />
        <Text style={{textAlign: 'center'}} type='Body'>By default, we prevent android from showing the screen on the App Switcher and we prevent screenshots.</Text>
        <Text type='Body' style={{textAlign: 'center'}}>You can change this below</Text>
        <Checkbox
          label='Disable App switcher preview and screenshots.'
          onCheck={this._changeSecureFlagOption}
          checked={this.state.secureFlag} />
      </Box>
    )
  }
}

export default Screenprotector
