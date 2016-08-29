// @flow
import Container from './dev-container.desktop.js'
import DropdownDemo from './components/dropdown.desktop'
import React, {Component} from 'react'
import {Box, Button, Input, Text, Terminal, FormWithCheckbox} from '../common-adapters'
import {globalStyles, globalColors} from '../styles'

const Space = () => <Box style={{minHeight: 20, minWidth: 20}} />

const Row = ({children, style}) => (
  <Box style={{...globalStyles.flexBoxRow, marginBottom: 20, ...style}}>
    {children.map && children.map((c, idx) => [c, <Space key={idx} />]) || children}
  </Box>
)

const onClick = () => {
  console.log('clicked')
}

const Buttons = () => (
  <Box style={{...globalStyles.flexBoxColumn, padding: 10}}>
    <Row>
      <Button onClick={onClick} type='Primary' label='Primary' />
      <Button onClick={onClick} type='Primary' label='Primary' disabled={true} />
      <Button onClick={onClick} type='Primary' label='Primary' waiting={true} />
    </Row>
    <Row>
      <Button onClick={onClick} type='Secondary' label='Secondary' />
      <Button onClick={onClick} type='Secondary' label='Secondary' disabled={true} />
      <Button onClick={onClick} type='Secondary' label='Secondary' waiting={true} />
    </Row>
    <Row>
      <Button onClick={onClick} type='Danger' danger={true} label='Danger' />
      <Button onClick={onClick} type='Danger' danger={true} label='Danger' disabled={true} />
      <Button onClick={onClick} type='Danger' danger={true} label='Danger' waiting={true} />
    </Row>
    <Row>
      <Button onClick={onClick} type='Follow' label='Follow' />
      <Button onClick={onClick} type='Follow' label='Follow' disabled={true} />
      <Button onClick={onClick} type='Following' label='Following' />
      <Button onClick={onClick} type='Unfollow' label='Unfollow' />
    </Row>

    <Button onClick={onClick} type='Primary' fullWidth={true} label='Primary full-width' /><Space />
    <Button onClick={onClick} type='Primary' fullWidth={true} label='Primary full-width' waiting={true} /><Space />
    <Button onClick={onClick} type='Secondary' fullWidth={true} label='Secondary full-width' /><Space />
    <Button onClick={onClick} type='Secondary' fullWidth={true} label='Secondary full-width' waiting={true} /><Space />
    <Button onClick={onClick} type='Danger' fullWidth={true} label='Danger full-width' /><Space />
    <Button onClick={onClick} type='Danger' fullWidth={true} label='Danger full-width' waiting={true} /><Space />
    <Button onClick={onClick} type='Follow' fullWidth={true} label='Follow full-width' /><Space />
    <Button onClick={onClick} type='Follow' fullWidth={true} label='Follow full-width' waiting={true} />

    <Space />

    <Row>
      <Button onClick={onClick} type='Primary' small={true} label='Primary small' />
      <Button onClick={onClick} type='Secondary' small={true} label='Secondary small' />
      <Button onClick={onClick} type='Danger' small={true} label='Danger small' />
      <Button onClick={onClick} type='Follow' small={true} label='Follow small' />
    </Row>
    <Row>
      <Button waiting={true} onClick={onClick} type='Primary' small={true} label='Primary small' />
      <Button waiting={true} onClick={onClick} type='Secondary' small={true} label='Secondary small' />
      <Button waiting={true} onClick={onClick} type='Danger' small={true} label='Danger small' />
      <Button waiting={true} onClick={onClick} type='Follow' small={true} label='Follow small' />
    </Row>
    <Row style={{padding: 20, backgroundColor: globalColors.midnightBlue}}>
      <Button onClick={onClick} type='Secondary' label='Secondary terminal mode' backgroundMode='Terminal' />
    </Row>
    <Row style={{padding: 20, backgroundColor: globalColors.midnightBlue}}>
      <Button onClick={onClick} type='Secondary' fullWidth={true} label='Secondary full-width terminal mode' backgroundMode='Terminal' /><Space />
    </Row>
  </Box>
)

const Fonts = () => (
  <Box style={globalStyles.flexBoxColumn}>
    <Box style={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}>

      {['Normal', 'Terminal', 'Announcements', 'Success', 'Information', 'HighRisk', 'Documentation'].map(backgroundMode => {
        const background = {
          'Normal': globalColors.white,
          'Terminal': globalColors.darkBlue3,
          'Announcements': globalColors.blue,
          'Success': globalColors.green,
          'Information': globalColors.yellow,
          'HighRisk': globalColors.red,
          'Documentation': globalColors.darkBlue,
        }[backgroundMode]

        return (
          <Box key={backgroundMode} style={{...globalStyles.flexBoxColumn, padding: 40, minWidth: 500, backgroundColor: background}}>
            <Text backgroundMode={backgroundMode} type='HeaderJumbo'>{backgroundMode}</Text>
            <Text backgroundMode={backgroundMode} type='HeaderJumbo'>Header Jumbo</Text>
            <Text backgroundMode={backgroundMode} type='HeaderJumbo'>Header Jumbo</Text>
            <Space />
            <Space />
            <Space />
            <Text backgroundMode={backgroundMode} type='HeaderBig'>Header big Header big</Text>
            <Text backgroundMode={backgroundMode} type='HeaderBig'>Header big Header big</Text>
            <Space />
            <Space />
            <Space />
            <Text backgroundMode={backgroundMode} type='Header'>Header Header Header</Text>
            <Text backgroundMode={backgroundMode} type='Header'>Header Header Header</Text>
            <Space />
            <Text backgroundMode={backgroundMode} type='HeaderLink'>Header link Header Link</Text>
            <Text backgroundMode={backgroundMode} type='HeaderLink'>Header link Header Link</Text>
            <Space />
            <Text backgroundMode={backgroundMode} type='HeaderError'>Header error Header error</Text>
            <Text backgroundMode={backgroundMode} type='HeaderError'>Header error Header error</Text>
            <Space />
            <Space />
            <Space />
            <Text backgroundMode={backgroundMode} type='Body'>Body text Body text Body text</Text>
            <Text backgroundMode={backgroundMode} type='Body'>Body text Body text Body text</Text>
            <Space />
            <Text backgroundMode={backgroundMode} type='BodySemibold'>Body semibold Body semibold</Text>
            <Text backgroundMode={backgroundMode} type='BodySemibold'>Body semibold Body semibold</Text>
            <Space />
            <Text backgroundMode={backgroundMode} type='BodyPrimaryLink'>Body primary link</Text>
            <Text backgroundMode={backgroundMode} type='BodyPrimaryLink'>Body primary link hover</Text>
            <Space />
            <Space />
            <Space />
            <Box>
              <Text backgroundMode={backgroundMode} type='BodySmall'>Body small Body Small&nbsp;</Text>
              <Text backgroundMode={backgroundMode} type='BodySmallLink'>inline link</Text>
            </Box>
            <Box>
              <Text backgroundMode={backgroundMode} type='BodySmall'>Body small Body Small&nbsp;</Text>
              <Text backgroundMode={backgroundMode} type='BodySmallLink'>inline link hover</Text>
            </Box>
            <Space />
            <Text backgroundMode={backgroundMode} type='BodySmallError'>Body small error Body small error</Text>
            <Text backgroundMode={backgroundMode} type='BodySmallError'>Body small error Body small error</Text>
            <Space />
            <Text backgroundMode={backgroundMode} type='BodySmallPrimaryLink'>Body small primary link</Text>
            <Text backgroundMode={backgroundMode} type='BodySmallPrimaryLink'>Body small primary link hover</Text>
            <Space />
            <Text backgroundMode={backgroundMode} type='BodySmallSecondaryLink'>Body small secondary link</Text>
            <Text backgroundMode={backgroundMode} type='BodySmallSecondaryLink'>Body small secondary link hover</Text>
            <Space />
            <Space />
            <Space />
            <Box>
              <Text backgroundMode={backgroundMode} type='BodyXSmall'>Body x-small Body x-small&nbsp;</Text>
              <Text backgroundMode={backgroundMode} type='BodyXSmallLink'>inline link</Text>
            </Box>
            <Box>
              <Text backgroundMode={backgroundMode} type='BodyXSmall'>Body x-small Body x-small&nbsp;</Text>
              <Text backgroundMode={backgroundMode} type='BodyXSmallLink'>inline link hover</Text>
            </Box>
            <Space />

            <Text backgroundMode={backgroundMode} type='BodySmallSemibold'>Body small Semibold Body Small Semibold</Text>
            <Text backgroundMode={backgroundMode} type='BodySmallSemibold'>Body small Semibold Body Small Semibold</Text>
            <Space />
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
      <Box key={c} style={{...globalStyles.flexBoxRow, height: 60, margin: 5, minWidth: 230}}>
        <Box style={{width: 60, height: 60, backgroundColor: globalColors[c]}} />
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', marginLeft: 5}}>
          <Text type='Body'>{c}</Text>
          <Text type='Body' small={true}>{globalColors[c]}</Text>
        </Box>
      </Box>)
    )}
    </Box>
  </Box>
)

const Dropdowns = () => (
  <DropdownDemo />
)

const Inputs = () => (
  <Box style={{...globalStyles.flexBoxColumn, maxWidth: 250}}>
    <Input floatingLabelText='Label' />
    <Input floatingLabelText='Label' errorText='Error lorem ipsum dolor sit amet.' />
    <Input multiLine={true} floatingLabelText='Multiline' />
    <Input multiLine={true} floatingLabelText='Multiline' errorText='Error lorem ipsum dolor sit amet.' />
    <Input floatingLabelText='Label' />
    <Input floatingLabelText='foo' rows={1} rowsMax={3} multiLine={true} />
    <Input hintText='foo' rows={1} rowsMax={3} multiLine={true} />
    <Input multiLine={true} hintText='opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas' style={{marginTop: 30}} />
    <Input small={true} hintText='user1,user2,etc' style={{width: '100%', marginLeft: 2}} />
    <FormWithCheckbox
      inputProps={{floatingLabelText: 'Passphrase', style: {marginBottom: 0}, errorText: 'Error Message'}}
      checkboxesProps={[
        {label: 'Save in Keychain', checked: true, onCheck: () => {}},
        {label: 'Show Typing', checked: true, onCheck: () => {}},
      ]}
    />
  </Box>
)

class Render extends Component {
  render () {
    return (
      <Box style={{flex: 1, ...globalStyles.scrollable, padding: 20}}>
        <Container title='Text'><Fonts /></Container>
        <Container title='Buttons'><Buttons /></Container>
        <Container title='Dropdown'><Dropdowns /></Container>
        <Container title='Colors'><Colors /></Container>
        <Container title='Inputs'><Inputs /></Container>
      </Box>
    )
  }
}

export default Render
