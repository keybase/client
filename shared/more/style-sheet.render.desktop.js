/* @flow */
import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'
import Container from './dev-container.desktop.js'
import {Icon, Box, Button, Input, Text, Terminal, FormWithCheckbox} from '../common-adapters'

import DropdownDemo from './components/dropdown.desktop'

const Space = () => <Box style={{minHeight: 20, minWidth: 20}}/>

const Row = ({children, style}) => (
  <Box style={{...globalStyles.flexBoxRow, marginBottom: 20, ...style}}>
    {children.map && children.map(c => [c, <Space/>]) || children}
  </Box>
)

const onClick = () => {
  console.log('clicked')
}

const Buttons = () => (
  <Box style={{...globalStyles.flexBoxColumn, padding: 10}}>
    <Row>
      <Button onClick={onClick} type='Primary' label='Primary'/>
      <Button onClick={onClick} type='Primary' label='Primary' disabled/>
      <Button onClick={onClick} type='Primary' label='Primary' waiting/>
    </Row>
    <Row>
      <Button onClick={onClick} type='Secondary' label='Secondary'/>
      <Button onClick={onClick} type='Secondary' label='Secondary' disabled/>
      <Button onClick={onClick} type='Secondary' label='Secondary' waiting/>
    </Row>
    <Row>
      <Button onClick={onClick} type='Danger' danger label='Danger'/>
      <Button onClick={onClick} type='Danger' danger label='Danger' disabled/>
      <Button onClick={onClick} type='Danger' danger label='Danger' waiting/>
    </Row>
    <Row>
      <Button onClick={onClick} type='Follow' label='Follow'/>
      <Button onClick={onClick} type='Follow' label='Follow' disabled/>
      <Button onClick={onClick} type='Following' label='Following'/>
      <Button onClick={onClick} type='Unfollow' label='Unfollow'/>
    </Row>

    <Button onClick={onClick} type='Primary' fullWidth label='Primary full-width'/><Space/>
    <Button onClick={onClick} type='Primary' fullWidth label='Primary full-width' waiting/><Space/>
    <Button onClick={onClick} type='Secondary' fullWidth label='Secondary full-width'/><Space/>
    <Button onClick={onClick} type='Secondary' fullWidth label='Secondary full-width' waiting/><Space/>
    <Button onClick={onClick} type='Danger' fullWidth label='Danger full-width'/><Space/>
    <Button onClick={onClick} type='Danger' fullWidth label='Danger full-width' waiting/><Space/>
    <Button onClick={onClick} type='Follow' fullWidth label='Follow full-width'/><Space/>
    <Button onClick={onClick} type='Follow' fullWidth label='Follow full-width' waiting/>

    <Space/>

    <Row>
      <Button onClick={onClick} type='Primary' small label='Primary small'/>
      <Button onClick={onClick} type='Secondary' small label='Secondary small'/>
      <Button onClick={onClick} type='Danger' small label='Danger small'/>
      <Button onClick={onClick} type='Follow' small label='Follow small'/>
    </Row>
    <Row>
      <Button waiting onClick={onClick} type='Primary' small label='Primary small'/>
      <Button waiting onClick={onClick} type='Secondary' small label='Secondary small'/>
      <Button waiting onClick={onClick} type='Danger' small label='Danger small'/>
      <Button waiting onClick={onClick} type='Follow' small label='Follow small'/>
    </Row>
  </Box>
)

const Fonts = () => (
  <Box style={globalStyles.flexBoxColumn}>
    <Box style={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}>

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
          <Box style={{...globalStyles.flexBoxColumn, padding: 40, minWidth: 500, backgroundColor: background}}>
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
    </Box>

    <Box style={globalStyles.flexBoxRow}>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, padding: 10}}>
        <p>
          <Text type='BodySmall'>Word word </Text>
          <Text type='Terminal'>inline command line </Text>
          <Text type='TerminalUsername'>username </Text>
          <Text type='TerminalPrivate'>'secret'</Text>
          <Text type='BodySmall'> word word word word word </Text>
          <Text type='Terminal'>inline command line</Text>
        </p>
      </Box>
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
    </Box>
  </Box>
)

const Colors = () => (
  <Box style={{...globalStyles.flexBoxColumn, flexWrap: 'wrap'}}>
    <Text type='Body'>Colors</Text>
    <Box style={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}>
    {Object.keys(globalColors).sort().map(c => (
      <Box style={{...globalStyles.flexBoxRow, height: 60, margin: 5, minWidth: 230}}>
        <Box style={{width: 60, height: 60, backgroundColor: globalColors[c]}}/>
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', marginLeft: 5}}>
          <Text type='Body'>{c}</Text>
          <Text type='Body' small>{globalColors[c]}</Text>
        </Box>
      </Box>)
    )}
    </Box>
  </Box>
)

const Dropdowns = () => (
  <DropdownDemo/>
)

const Icons = () => (
  <Box style={{...globalStyles.flexBoxRow, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start'}}>
    {[
      'computer-big',
      'computer-bw-m',
      'fa-custom-copy',
      'fa-custom-eye',
      'fa-custom-key',
      'logo-128',
      'fa-custom-icon-proof-broken',
      'fa-custom-icon-proof-good-followed',
      'fa-custom-icon-proof-good-new',
      'fa-close',
      'fa-mobile'
    ].map(i => [
      <Icon onClick={() => console.log('clicked')} type={i} />,
      <Space/>,
      <Icon style={{width: 100, height: 100}} onClick={() => console.log('clicked')} type={i} />,
      <Space/>
    ])}
    <Row key='a'><Icon type='fa-custom-copy' style={{color: globalColors.blue}}/></Row>
    <Row key='a1'><Icon type='fa-custom-copy' style={{color: globalColors.green}}/></Row>
    <Row key='a2'><Icon type='fa-custom-copy' style={{color: globalColors.orange}}/></Row>
  </Box>
)

const Inputs = () => (
  <Box style={{...globalStyles.flexBoxColumn, maxWidth: 250}}>
    <Input floatingLabelText='Label' />
    <Input floatingLabelText='Label' errorText='Error lorem ipsum dolor sit amet.'/>
    <Input multiLine floatingLabelText='Multiline'/>
    <Input multiLine floatingLabelText='Multiline' errorText='Error lorem ipsum dolor sit amet.'/>
    <Input floatingLabelText='Label'/>
    <Input floatingLabelText='foo' rows={1} rowsMax={3} multiLine />
    <Input hintText='foo' rows={1} rowsMax={3} multiLine />
    <Input multiLine hintText='opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas' style={{marginTop: 30}} />
    <Input small hintText='user1,user2,etc' style={{width: '100%', marginLeft: 2}} />
    <FormWithCheckbox
      inputProps={{floatingLabelText: 'Passphrase', style: {marginBottom: 0}, errorText: 'Error Message'}}
      checkboxesProps={[
        {label: 'Save in Keychain', checked: true, onCheck: () => {}},
        {label: 'Show Typing', checked: true, onCheck: () => {}}
      ]}
    />
  </Box>
)

export default class Render extends Component {
  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, margin: 20}}>
        <Container title='Icons'><Icons/></Container>
        <Container title='Buttons'><Buttons/></Container>
        <Container title='Dropdown'><Dropdowns/></Container>
        <Container title='Text'><Fonts/></Container>
        <Container title='Colors'><Colors/></Container>
        <Container title='Inputs'><Inputs/></Container>
      </Box>
    )
  }
}

