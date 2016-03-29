/* @flow */
import React, {Component} from 'react'
import {ScrollView} from 'react-native'
import {globalStyles, globalColors} from '../styles/style-guide'
import Container from './dev-container.native'
import {Button, Box, Text, Terminal} from '../common-adapters'
// import {Button, Input, Text, Terminal, FormWithCheckbox} from '../common-adapters'
// import DropdownDemo from './components/dropdown.desktop'
//

const Space = () => <Box style={{height: 20, width: 20}}/>

const ButtonRow = ({children}) => (
  <Box style={{...globalStyles.flexBoxRow, marginBottom: 20}}>
    {children.map && children.map(c => [c, <Space/>]) || children}
  </Box>
)

const onClick = () => {
  console.log('clicked')
}

const Buttons = () => (
  <Box style={{...globalStyles.flexBoxColumn, padding: 10}}>
    <ButtonRow>
      <Button onClick={onClick} type='Primary' label='Primary'/>
      <Button onClick={onClick} type='Primary' label='Primary' disabled/>
    </ButtonRow>
    <ButtonRow>
      <Button onClick={onClick} type='Primary' label='Primary' waiting/>
    </ButtonRow>
    <ButtonRow>
      <Button onClick={onClick} type='Secondary' label='Secondary'/>
      <Button onClick={onClick} type='Secondary' label='Secondary' disabled/>
    </ButtonRow>
    <ButtonRow>
      <Button onClick={onClick} type='Secondary' label='Secondary' waiting/>
    </ButtonRow>
    <ButtonRow>
      <Button onClick={onClick} type='Danger' danger label='Danger'/>
      <Button onClick={onClick} type='Danger' danger label='Danger' disabled/>
    </ButtonRow>
    <ButtonRow>
      <Button onClick={onClick} type='Danger' danger label='Danger' waiting/>
    </ButtonRow>
    <ButtonRow>
      <Button onClick={onClick} type='Follow' label='Follow'/>
      <Button onClick={onClick} type='Follow' label='Follow' disabled/>
    </ButtonRow>
    <ButtonRow>
      <Button onClick={onClick} type='Following' label='Following'/>
    </ButtonRow>
    <ButtonRow>
      <Button onClick={onClick} type='Unfollow' label='Unfollow'/>
    </ButtonRow>

    <Button onClick={onClick} type='Primary' fullWidth label='Primary full-width'/><Space/>
    <Button onClick={onClick} type='Primary' fullWidth label='Primary full-width' waiting/><Space/>
    <Button onClick={onClick} type='Secondary' fullWidth label='Secondary full-width'/><Space/>
    <Button onClick={onClick} type='Secondary' fullWidth label='Secondary full-width' waiting/><Space/>
    <Button onClick={onClick} type='Danger' fullWidth label='Danger full-width'/><Space/>
    <Button onClick={onClick} type='Danger' fullWidth label='Danger full-width' waiting/><Space/>
    <Button onClick={onClick} type='Follow' fullWidth label='Follow full-width'/><Space/>
    <Button onClick={onClick} type='Follow' fullWidth label='Follow full-width' waiting/>
  </Box>
)

const Fonts = () => (
  <Box style={globalStyles.flexBoxColumn}>
    {['Normal', 'Announcements', 'Success', 'Information', 'HighRisk', 'Documentation', 'Terminal'].map(backgroundMode => {
      const background = {
        'Normal': globalColors.white,
        'Announcements': globalColors.blue,
        'Success': globalColors.green,
        'Information': globalColors.yellow,
        'HighRisk': globalColors.red,
        'Documentation': globalColors.darkBlue,
        'Terminal': globalColors.darkBlue3
      }[backgroundMode]

      return (
        <Box key={background} style={{...globalStyles.flexBoxColumn, padding: 40, backgroundColor: background}}>
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
        </Box>) })}
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, padding: 10}}>
      <Text type='Body'>
        <Text type='BodySmall'>Word word </Text>
        <Text type='Terminal'>inline command line </Text>
        <Text type='TerminalUsername'>username </Text>
        <Text type='TerminalPrivate'>'secret'</Text>
        <Text type='BodySmall'> word word word word word </Text>
        <Text type='Terminal'>inline command line</Text>
      </Text>
    </Box>
    <Terminal style={{flex: 1}}>
      <Text type='Body'>
        <Text type='Terminal'>command line stuff </Text>
        <Text type='TerminalUsername'>username </Text>
        <Text type='TerminalPrivate'>'something secret'</Text>
      </Text>

      <Text type='Body'>
        <Text type='Terminal'>command line stuff </Text>
        <Text type='TerminalUsername'>username </Text>
        <Text type='TerminalPublic'>'something public'</Text>
      </Text>

      <Text type='TerminalComment'>comment</Text>
      <Text type='TerminalComment'>comment</Text>
    </Terminal>
  </Box>
)

const Colors = () => (
  <Box style={{...globalStyles.flexBoxColumn}}>
    {Object.keys(globalColors).sort().map(c => (
      <Box key={c} style={{...globalStyles.flexBoxRow, margin: 5}}>
        <Box style={{width: 60, height: 60, backgroundColor: globalColors[c]}}/>
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', marginLeft: 5}}>
          <Text type='Body'>{c}</Text>
          <Text type='Body' small>{globalColors[c]}</Text>
        </Box>
      </Box>
      ))}
  </Box>
)

const Dropdowns = () => (
  <Text type='Header'>TODO</Text>
)
// <DropdownDemo/>

const Icons = () => (
  <Text type='Header'>TODO</Text>
)

const Inputs = () => (
  <Text type='Header'>TODO</Text>
)

export default class Render extends Component {
  render () {
    return (
      <ScrollView>
        <Container title='Buttons'><Buttons/></Container>
        <Container title='Dropdown'><Dropdowns/></Container>
        <Container title='Text'><Fonts/></Container>
        <Container title='Colors'><Colors/></Container>
        <Container title='Icons'><Icons/></Container>
        <Container title='Inputs'><Inputs/></Container>
      </ScrollView>
    )

        // <Container title='Icons'>
          // <div style={{...globalStyles.flexBoxColumn}}>
            // <p>TODO</p>
          // </div>
        // </Container>
        // <Container title='Inputs'>
          // <div style={{...globalStyles.flexBoxColumn, maxWidth: 250}}>
            // <Input floatingLabelText='Label' />
            // <Input floatingLabelText='Label' errorText='Error lorem ipsum dolor sit amet.'/>
            // <Input multiLine floatingLabelText='Multiline'/>
            // <Input multiLine floatingLabelText='Multiline' errorText='Error lorem ipsum dolor sit amet.'/>
            // <Input floatingLabelText='Label'/>
            // <Input floatingLabelText='foo' rows={1} rowsMax={3} multiLine />
            // <Input hintText='foo' rows={1} rowsMax={3} multiLine />
            // <Input multiLine hintText='opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas' style={{marginTop: 30}} />
            // <Input small hintText='user1,user2,etc' style={{width: '100%', marginLeft: 2}} />
            // <FormWithCheckbox
              // inputProps={{floatingLabelText: 'Passphrase', style: {marginBottom: 0}, errorText: 'Error Message'}}
              // checkboxesProps={[
                // {label: 'Save in Keychain', checked: true, onCheck: () => {}},
                // {label: 'Show Typing', checked: true, onCheck: () => {}}
              // ]}
            // />
          // </div>
        // </Container>
      // </div>)
  }
}

