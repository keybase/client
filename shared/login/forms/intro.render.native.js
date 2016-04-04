import React, {Component} from 'react'
import {Box, Button, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'

export default class Render extends Component {
  render () {
    return (
      <Box style={styles.loginForm}>
        <Icon type='logo-160'/>
        <Text style={styles.header} type='HeaderJumbo'>Join Keybase</Text>
        <Text style={styles.headerSub} type='Body'>Folders for anyone in the world.</Text>
        <Button style={styles.button} type='Primary' onClick={this.props.onSignup} label='Create an account' />
        <Text style={styles.loginHeader} type='Body' onClick={this.props.onLogin}>Already on Keybase?</Text>
        <Button style={styles.button} type='Secondary' onClick={this.props.onLogin} label='Log in' />
      </Box>
    )
  }
}

const styles = {
  loginForm: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    marginTop: 55,
    flex: 1
  },
  header: {
    marginTop: 27,
    color: globalColors.orange
  },
  headerSub: {
    marginTop: 10
  },
  loginHeader: {
    marginTop: 91,
    textAlign: 'center'
  },
  button: {
    marginTop: 15
  }
}
