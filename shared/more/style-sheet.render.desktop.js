import React, {Component} from 'react'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import Container from './dev-container'
import {Button, Logo, Input, Text, Terminal} from '../common-adapters'

export default class Render extends Component {
  render () {
    return (
      <div style={{...globalStyles.flexBoxColumn, margin: 20}}>
        <Container title='Text - DZ2'>
          <DZ2Font/>
        </Container>
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
        <Container title='Colors - DZ2'>
          <div style={{...globalStyles.flexBoxColumn, flexWrap: 'wrap'}}>
            <Text type='Body'>Colors</Text>
            <div style={{...globalStyles.flexBoxColumn, flexWrap: 'wrap', height: 350}}>
            {Object.keys(globalColorsDZ2).sort().map(c => {
              return (
                <div style={{...globalStyles.flexBoxRow, height: 60, margin: 5}}>
                  <div style={{width: 60, height: 60, backgroundColor: globalColorsDZ2[c]}}></div>
                  <div style={{...globalStyles.flexBoxColumn, justifyContent: 'center', marginLeft: 5}}>
                    <Text type='Body'>{c}</Text>
                    <Text type='Body' small>{globalColorsDZ2[c]}</Text>
                  </div>
                </div>
              ) }
            )}
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

class DZ2Font extends Component {
  render () {
    const Space = () => <div style={{height: 20}}/>
    return (
      <div style={globalStyles.flexBoxColumn}>
        <div style={globalStyles.flexBoxRow}>

          {[false, true].map(darkMode => (
            <div style={
              {...globalStyles.flexBoxColumn,
                flex: 1,
                padding: 40,
                backgroundColor: (darkMode ? globalColorsDZ2.darkBlue : globalColorsDZ2.white)}}>
              <Text dz2 darkMode={darkMode} type='HeaderJumbo'>Header Jumbo</Text>
              <Text dz2 darkMode={darkMode} type='HeaderJumbo'>Header Jumbo</Text>
              <Space/>
              <Text dz2 darkMode={darkMode} type='HeaderBig'>Header Big Header Big</Text>
              <Text dz2 darkMode={darkMode} type='HeaderBig'>Header Big Header Big</Text>
              <Space/>
              <Text dz2 darkMode={darkMode} type='Header'>Header Header Header</Text>
              <Text dz2 darkMode={darkMode} type='Header'>Header Header Header</Text>
              <Space/>
              <Text dz2 darkMode={darkMode} type='Body'>Body Body</Text>
              <Text dz2 darkMode={darkMode} type='Body'>Body Body</Text>
              <Space/>
              <Text dz2 darkMode={darkMode} type='BodySemibold'>Body Semibold Body Semibold</Text>
              <Text dz2 darkMode={darkMode} type='BodySemibold'>Body Semibold Body Semibold</Text>
              <Space/>
              <Text dz2 darkMode={darkMode} type='BodySmall'>Body small Body Small</Text>
              <Text dz2 darkMode={darkMode} type='BodySmall'>Body small Body Small</Text>
              <Space/>

              <div style={{...globalStyles.flexBoxRow, alignItems: 'baseline', justifyContent: 'center', backgroundColor: globalColorsDZ2.yellow, paddingTop: 10, paddingBottom: 10}}>
                <Text dz2 type='HeaderBig' warning style={{marginLeft: 10, marginRight: 10}}>k</Text>
                <Text dz2 type='BodySmall' warning>brown {'60%'}</Text>
              </div>
            </div>))}
        </div>

        <div style={globalStyles.flexBoxRow}>
          <div style={{...globalStyles.flexBoxColumn, flex: 1, padding: 10}}>
            <p>
              <Text dz2 inline type='BodySmall'>Word word word word word&nbsp;</Text>
              <Text dz2 inline type='Terminal'>inline command line&nbsp;</Text>
              <Text dz2 inline type='TerminalUsername'>username&nbsp;</Text>
              <Text dz2 inline type='TerminalPrivate'>{`'secret'`}</Text>
            </p>
          </div>
          <Terminal dz2 style={{flex: 1, overflow: 'scroll'}}>
            <div style={{...globalStyles.flexBoxRow}}>
              <Text dz2 type='Terminal'>command line stuff&nbsp;</Text>
              <Text dz2 type='TerminalUsername'>username&nbsp;</Text>
              <Text dz2 type='TerminalPrivate'>something secret</Text>
            </div>

            <div style={{...globalStyles.flexBoxRow}}>
              <Text dz2 type='Terminal'>command line stuff&nbsp;</Text>
              <Text dz2 type='TerminalUsername'>username&nbsp;</Text>
              <Text dz2 type='TerminalPublic'>something public</Text>
            </div>

            <Text dz2 type='Terminal'>command line stuff</Text>
            <Text dz2 type='TerminalComment'>comment and stuff</Text>
          </Terminal>
        </div>
      </div>
    )
  }
}

Render.propTypes = {
  colors: React.PropTypes.any
}
