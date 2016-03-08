/* @flow */
import React, {Component} from 'react'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import Container from './dev-container.desktop.js'
import {Button, Input, Text, Terminal, FormWithCheckbox} from '../common-adapters'

import DropdownDemo from './components/dropdown.desktop'

export default class Render extends Component {
  render () {
    const Space = () => <div style={{height: 20}}/>

    return (
      <div style={{...globalStyles.flexBoxColumn, margin: 20}}>
        <Container title='Dropdown - DZ2'>
          <DropdownDemo/>
        </Container>
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
            <div style={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}>
            {Object.keys(globalColorsDZ2).sort().map(c => {
              return (
                <div style={{...globalStyles.flexBoxRow, height: 60, margin: 5, minWidth: 230}}>
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
        <Container title='Buttons' style={{order: -1}}>
          <div style={{...globalStyles.flexBoxColumn, padding: 10, paddingRight: 100}}>
            <div style={{...globalStyles.flexBoxRow}}>
              <div style={{...globalStyles.flexBoxColumn, alignItems: 'flex-start', justifyContents: 'flex-start', padding: 10, paddingRight: 100}}>
                <Button onClick={() => {}} type='Primary' label='Primary'/><Space/>
                <Button onClick={() => {}} type='Secondary' label='Secondary'/><Space/>
                <Button onClick={() => {}} type='Danger' danger label='Danger'/><Space/>
                <Space/>
                <Button onClick={() => {}} type='Follow' label='Follow'/><Space/>
                <Button onClick={() => {}} type='Following' label='Following'/><Space/>
                <Button onClick={() => {}} type='Unfollow' label='Unfollow'/><Space/>
              </div>
              <div style={{...globalStyles.flexBoxColumn, alignItems: 'flex-start', justifyContents: 'flex-start', padding: 10, paddingRight: 100}}>
                <Button onClick={() => {}} type='Primary' disabled label='Primary disabled'/><Space/>
                <Button onClick={() => {}} type='Secondary' disabled label='Secondary disabled'/><Space/>
                <Button onClick={() => {}} type='Danger' disabled label='Danger disabled'/><Space/>
                <Space/>
                <Button onClick={() => {}} type='Follow' disabled label='Follow disabled'/><Space/>
              </div>
              <div style={{...globalStyles.flexBoxColumn, alignItems: 'flex-start', justifyContents: 'flex-start', padding: 10, paddingRight: 100}}>
                <Button onClick={() => {}} type='Primary' label='Primary' waiting/><Space/>
                <Button onClick={() => {}} type='Secondary' label='Secondary' waiting/><Space/>
                <Button onClick={() => {}} type='Danger' danger label='Danger' waiting/><Space/>
                <Space/>
                <Button onClick={() => {}} type='Follow' label='Follow' waiting/><Space/>
                <Button onClick={() => {}} type='Following' label='Following' waiting/><Space/>
                <Button onClick={() => {}} type='Unfollow' label='Unfollow' waiting/><Space/>
              </div>
            </div>

            <div style={{...globalStyles.flexBoxColumn, alignItems: 'flex-start', justifyContents: 'flex-start', padding: 10}}>
              <Button onClick={() => {}} type='Primary' fullWidth label='Primary full-width'/><Space/>
              <Button onClick={() => {}} type='Primary' fullWidth label='Primary full-width' waiting/><Space/>
              <Button onClick={() => {}} type='Secondary' fullWidth label='Secondary full-width'/><Space/>
              <Button onClick={() => {}} type='Secondary' fullWidth label='Secondary full-width' waiting/><Space/>
              <Button onClick={() => {}} type='Danger' fullWidth label='Danger full-width'/><Space/>
              <Button onClick={() => {}} type='Danger' fullWidth label='Danger full-width' waiting/><Space/>
              <Button onClick={() => {}} type='Follow' fullWidth label='Follow full-width'/><Space/>
              <Button onClick={() => {}} type='Follow' fullWidth label='Follow full-width' waiting/><Space/>
            </div>

            <div style={{...globalStyles.flexBoxRow}}>
              <div style={{...globalStyles.flexBoxColumn, alignItems: 'flex-start', justifyContents: 'flex-start', padding: 10, paddingRight: 100}}>
                <Button onClick={() => {}} type='Primary' small label='Primary small'/><Space/>
                <Button onClick={() => {}} type='Secondary' small label='Secondary small'/><Space/>
                <Button onClick={() => {}} type='Danger' small label='Danger small'/><Space/>
                <Button onClick={() => {}} type='Follow' small label='Follow small'/><Space/>
              </div>
              <div style={{...globalStyles.flexBoxColumn, alignItems: 'flex-start', justifyContents: 'flex-start', padding: 10, paddingRight: 100}}>
                <Button waiting onClick={() => {}} type='Primary' small label='Primary small'/><Space/>
                <Button waiting onClick={() => {}} type='Secondary' small label='Secondary small'/><Space/>
                <Button waiting onClick={() => {}} type='Danger' small label='Danger small'/><Space/>
                <Button waiting onClick={() => {}} type='Follow' small label='Follow small'/><Space/>
              </div>
            </div>
          </div>

        </Container>
        <Container title='Icons'>
          <div style={{...globalStyles.flexBoxColumn}}>
            <p>TODO</p>
          </div>
        </Container>
        <Container title='Inputs'>
          <div style={{...globalStyles.flexBoxColumn, maxWidth: 250}}>
            <Input floatingLabelText='Label' />
            <Input floatingLabelText='Label' errorText='Error lorem ipsum dolor sit amet.'/>
            <Input multiLine floatingLabelText='Multiline'/>
            <Input multiLine floatingLabelText='Multiline' errorText='Error lorem ipsum dolor sit amet.'/>
            <Input floatingLabelText='Label' defaultValue='Blah'/>
            <Input floatingLabelText='foo' rows={1} rowsMax={3} multiLine />
            <Input hintText='foo' rows={1} rowsMax={3} multiLine />
            <Input multiLine hintText='opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas' style={{marginTop: 30}} />
            <Input small hintText='user1,user2,etc' style={{width: '100%', marginLeft: 2}} />
            <FormWithCheckbox
              inputProps={{dz2: true, floatingLabelText: 'Passphrase', style: {marginBottom: 0}, errorText: 'Error Message'}}
              checkboxesProps={[
                {label: 'Save in Keychain', checked: true, onCheck: () => {}},
                {label: 'Show Typing', checked: true, onCheck: () => {}}
              ]}
            />
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
        <div style={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}>

          {['Normal', 'Announcements', 'Success', 'Information', 'HighRisk', 'Documentation', 'Terminal'].map(backgroundMode => {
            const background = {
              'Normal': globalColorsDZ2.white,
              'Announcements': globalColorsDZ2.blue,
              'Success': globalColorsDZ2.green,
              'Information': globalColorsDZ2.yellow,
              'HighRisk': globalColorsDZ2.red,
              'Documentation': globalColorsDZ2.darkBlue,
              'Terminal': globalColorsDZ2.darkBlue3
            }[backgroundMode]

            return (
              <div style={
                {...globalStyles.flexBoxColumn,
                  padding: 40,
                  minWidth: 500,
                  backgroundColor: background}}>
                <Text backgroundMode={backgroundMode} type='HeaderJumbo'>{backgroundMode}</Text>
                <Text backgroundMode={backgroundMode} type='HeaderJumbo'>Header Jumbo</Text>
                <Text backgroundMode={backgroundMode} type='HeaderJumbo'>Header Jumbo</Text>
                <Space/>
                <Text backgroundMode={backgroundMode} type='HeaderBig'>Header Big Header Big</Text>
                <Text backgroundMode={backgroundMode} type='HeaderBig'>Header Big Header Big</Text>
                <Space/>
                <Text backgroundMode={backgroundMode} type='Header'>Header Header Header</Text>
                <Text backgroundMode={backgroundMode} type='Header'>Header Header Header</Text>
                <Space/>
                <Text backgroundMode={backgroundMode} type='Body'>Body Body</Text>
                <Text backgroundMode={backgroundMode} type='Body'>Body Body</Text>
                <Space/>
                <Text backgroundMode={backgroundMode} type='BodySemibold'>Body Semibold Body Semibold</Text>
                <Text backgroundMode={backgroundMode} type='BodySemibold'>Body Semibold Body Semibold</Text>
                <Space/>
                <Text backgroundMode={backgroundMode} type='BodySmallSemibold'>Body small Semibold Body Small Semibold</Text>
                <Text backgroundMode={backgroundMode} type='BodySmallSemibold'>Body small Semibold Body Small Semibold</Text>
                <Space/>
                <Text backgroundMode={backgroundMode} type='BodySmall'>Body small Body Small</Text>
                <Text backgroundMode={backgroundMode} type='BodySmall'>Body small Body Small</Text>
              </div>) })}
        </div>

        <div style={globalStyles.flexBoxRow}>
          <div style={{...globalStyles.flexBoxColumn, flex: 1, padding: 10}}>
            <p>
              <Text type='BodySmall'>Word word </Text>
              <Text type='Terminal'>inline command line </Text>
              <Text type='TerminalUsername'>username </Text>
              <Text type='TerminalPrivate'>'secret'</Text>
              <Text type='BodySmall'> word word word word word </Text>
              <Text type='Terminal'>inline command line</Text>
            </p>
          </div>
          <Terminal style={{flex: 1, overflow: 'scroll'}}>
            <p>
              <Text type='Terminal'>command line stuff </Text>
              <Text type='TerminalUsername'>username </Text>
              <Text type='TerminalPrivate'>'something secret'</Text>
            </p>

            <p>
              <Text type='Terminal'>command line stuff </Text>
              <Text type='TerminalUsername'>username </Text>
              <Text type='TerminalPublic'>'something public'</Text>
            </p>

            <Text type='TerminalComment'>comment</Text>
            <Text type='TerminalComment'>comment</Text>
          </Terminal>
        </div>
      </div>
    )
  }
}

Render.propTypes = {
  colors: React.PropTypes.any
}
