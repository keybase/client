import React, {Component} from 'react'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import Container from './dev-container'
import {Button, Logo, Input, Text} from '../common-adapters'

export default class Render extends Component {
  render () {
    return (
      <div style={{...globalStyles.flexBoxColumn, margin: 20}}>
        <Container title='Text:DZ2'>
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
              <Text darkMode={darkMode} type='Header-Jumbo'>Header Jumbo</Text>
              <Text darkMode={darkMode} type='Header-Jumbo'>Header Jumbo</Text>
              <Space/>
              <Text darkMode={darkMode} type='Header-Big'>Header Big Header Big</Text>
              <Text darkMode={darkMode} type='Header-Big'>Header Big Header Big</Text>
              <Space/>
              <Text darkMode={darkMode} type='Header'>Header Header Header</Text>
              <Text darkMode={darkMode} type='Header'>Header Header Header</Text>
              <Space/>
              <Text darkMode={darkMode} type='Body'>Body Body</Text>
              <Text darkMode={darkMode} type='Body'>Body Body</Text>
              <Space/>
              <Text darkMode={darkMode} type='Body-Semibold'>Body Semibold Body Semibold</Text>
              <Text darkMode={darkMode} type='Body-Semibold'>Body Semibold Body Semibold</Text>
              <Space/>
              <Text darkMode={darkMode} type='Body-Small'>Body small Body Small</Text>
              <Text darkMode={darkMode} type='Body-Small'>Body small Body Small</Text>
              <Space/>

              <div style={{alignSelf: (darkMode ? 'flex-start' : 'flex-end')}}>
                {(darkMode ? [1.0, 0.75, 0.4] : [0.75, 0.4, 0.1]).map(opacity => (
                  darkMode ? (
                    <div style={{...globalStyles.flexBoxRow, alignItems: 'baseline'}}>
                      <Text darkMode type='Header-Big' style={{marginLeft: 10, marginRight: 10, opacity}}>k</Text>
                      <Text darkMode type='Body-Small' style={{opacity}}>White {opacity * 100 + '%'}</Text>
                    </div>
                    ) : (
                    <div style={{...globalStyles.flexBoxRow, alignItems: 'baseline'}}>
                      <Text type='Body-Small' style={{opacity}}>Black {opacity * 100 + '%'}</Text>
                      <Text type='Header-Big' style={{marginLeft: 10, marginRight: 10, opacity}}>k</Text>
                    </div>
                  )
                ))}
              </div>

              <Space/>
              <div style={{...globalStyles.flexBoxRow, alignItems: 'baseline', justifyContent: 'center', backgroundColor: globalColorsDZ2.yellow, paddingTop: 10, paddingBottom: 10}}>
                <Text type='Header-Big' style={{color: globalColorsDZ2.brown, opacity: 0.6, marginLeft: 10, marginRight: 10}}>k</Text>
                <Text type='Body-Small' style={{color: globalColorsDZ2.brown, opacity: 0.6}}>brown {'60%'}</Text>
              </div>
            </div>))}
        </div>

        <div style={globalStyles.flexBoxRow}>
          <div style={{...globalStyles.flexBoxColumn, flex: 1, padding: 20}}>
            <p>
              <Text inline type='Body-Small'>Word word word word word</Text>
              <Text inline type='Terminal-Inline' style={{paddingLeft: 6}}>inline command line</Text>
              <Text inline type='Terminal-Inline' style={{color: globalColorsDZ2.orange, padding: '0 6px'}}>{' username '}</Text>
              <Text inline type='Terminal-Inline' style={{color: globalColorsDZ2.darkBlue2}}>{`'secret'`}</Text>
            </p>
          </div>
          <div style={{...globalStyles.flexBoxColumn, flex: 1, backgroundColor: globalColorsDZ2.darkBlue3, padding: 20}}>
            <Text type='Terminal'>command line stuff</Text>
            <Text type='TerminalComment'>comment and stuff</Text>
          </div>
        </div>
      </div>
    )
  }
}

Render.propTypes = {
  colors: React.PropTypes.any
}
