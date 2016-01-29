import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'
import Container from './dev-container'
import {Button, Logo, Input, Text} from '../common-adapters'

export default class Render extends Component {
  render () {
    return (
      <div style={{...globalStyles.flexBoxColumn, margin: 20}}>
        <Container title='Text'>
          <div style={{...globalStyles.flexBoxRow}}>
            <div style={{...globalStyles.flexBoxColumn, flex: 1, padding: 20}}>
              <Text type='Header'>Header</Text>
              <Text type='Header' link>Header link</Text>
              <Text type='Body'>Body</Text>
              <Text type='Body' link>Body link</Text>
              <Text type='Body' small>Body small</Text>
              <Text type='Body' link small>Body link small</Text>
            </div>
            <div style={{...globalStyles.flexBoxColumn, flex: 1, padding: 20, backgroundColor: globalColors.blue}}>
              <Text type='Header' reversed>Header</Text>
              <Text type='Header' link reversed>Header link</Text>
              <Text type='Body' reversed>Body</Text>
              <Text type='Body' link reversed>Body link</Text>
              <Text type='Body' small reversed>Body small</Text>
              <Text type='Body' link small reversed>Body link small</Text>
            </div>
          </div>
        </Container>
        <Container title='Colors'>
          <div style={{...globalStyles.flexBoxColumn, flexWrap: 'wrap', height: 350}}>
          {Object.keys(this.props.colors).sort().map(c => {
            return (
              <div style={{...globalStyles.flexBoxRow, height: 60, margin: 5}}>
                <div style={{width: 60, height: 60, backgroundColor: this.props.colors[c]}}></div>
                <div style={{...globalStyles.flexBoxColumn, justifyContent: 'center', marginLeft: 5}}>
                  <Text type='Body'>{c}</Text>
                  <Text type='Body' small>{this.props.colors[c]}</Text>
                </div>
              </div>
            ) }
          )}
          </div>
        </Container>
        <Container title='Buttons'>
          <div style={{...globalStyles.flexBoxRow}}>
            <Button label='Secondary'/>
            <Button label='Primary' primary />
          </div>
        </Container>
        <Container title='Logos'>
          <div style={{...globalStyles.flexBoxRow, alignItems: 'baseline'}}>
            <Logo />
            <Logo small grey/>
          </div>
        </Container>
        <Container title='Icons'>
          <div style={{...globalStyles.flexBoxColumn}}>
            <p>TODO</p>
          </div>
        </Container>
        <Container title='Inputs'>
          <div style={{...globalStyles.flexBoxColumn}}>
            <Input floatingLabelText='Label' />
            <Input floatingLabelText='Label' errorText='Error lorem ipsum dolor sit amet.'/>
            <Input floatingLabelText='Label' defaultValue='Blah'/>
            <Input rows={1} rowsMax={3} multiLine />
          </div>
        </Container>
      </div>)
  }
}

Render.propTypes = {
  colors: React.PropTypes.any
}
