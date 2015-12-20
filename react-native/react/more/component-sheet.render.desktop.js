import React, {Component} from '../base-react'
import {Paper, AppBar, FlatButton} from 'material-ui'
import commonStyles from '../styles/common'
import Header from '../common-adapters/header'
import path from 'path'

import Menubar from '../menubar'

const Container = props => {
  return (
    <Paper zDepth={5} style={{margin: 20}}>
      <AppBar title={props.title}/>
      <div style={{margin: 10}}>
        {props.children}
      </div>
    </Paper>
  )
}

Container.propTypes = {
  title: React.PropTypes.string,
  style: React.PropTypes.object,
  children: React.PropTypes.node.isRequired
}

export default class Render extends Component {
  render () {
    return (
      <div style={{...commonStyles.flexBoxColumn, flex: 1, overflowY: 'auto'}}>
        <Container title='Menubar'>
          <Menubar/>
        </Container>
        <Container title='Header No Close'>
          <Header icon={`file:///${path.resolve(__dirname, '../images/service/keybase.png')}`} title='Title'/>
        </Container>
        <Container title='Header' style={{backgroundColor: 'red'}}>
          <Header icon={`file:///${path.resolve(__dirname, '../images/service/keybase.png')}`} title='Title' onClose={() => {}}/>
        </Container>
        <Container title='FlatButton Primary' style={{backgroundColor: 'red'}}>
          <FlatButton style={commonStyles.primaryButton} label='Primary' primary />
        </Container>
        <Container title='FlatButton Secondary' style={{backgroundColor: 'red'}}>
          <FlatButton style={commonStyles.secondaryButton} label='Secondary'/>
        </Container>
      </div>
  )
  }
}
