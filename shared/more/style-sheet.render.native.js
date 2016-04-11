/* @flow */
import React, {Component} from 'react'
import {Switch} from 'react-native'
import {ScrollView} from 'react-native'
import {globalStyles, globalColors} from '../styles/style-guide'
import Container from './dev-container.native'
import {Dropdown, Checkbox, Button, Box, Text, Terminal, Icon} from '../common-adapters'
import HiddenString from '../util/hidden-string'

import Success from '../login/signup/success/index.render'

const Space = () => <Box style={{height: 20, width: 20}}/>

const Row = ({children}) => (
  <Box style={{...globalStyles.flexBoxRow, marginBottom: 20}}>
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
    </Row>
    <Row>
      <Button onClick={onClick} type='Primary' label='Primary' waiting/>
    </Row>
    <Row>
      <Button onClick={onClick} type='Secondary' label='Secondary'/>
      <Button onClick={onClick} type='Secondary' label='Secondary' disabled/>
    </Row>
    <Row>
      <Button onClick={onClick} type='Secondary' label='Secondary' waiting/>
    </Row>
    <Row>
      <Button onClick={onClick} type='Danger' danger label='Danger'/>
      <Button onClick={onClick} type='Danger' danger label='Danger' disabled/>
    </Row>
    <Row>
      <Button onClick={onClick} type='Danger' danger label='Danger' waiting/>
    </Row>
    <Row>
      <Button onClick={onClick} type='Follow' label='Follow'/>
      <Button onClick={onClick} type='Follow' label='Follow' disabled/>
    </Row>
    <Row>
      <Button onClick={onClick} type='Following' label='Following'/>
    </Row>
    <Row>
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
      <Row key={c} style={{...globalStyles.flexBoxRow, margin: 5}}>
        <Box style={{width: 60, height: 60, backgroundColor: globalColors[c]}}/>
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', marginLeft: 5}}>
          <Text type='Body'>{c}</Text>
          <Text type='Body' small>{globalColors[c]}</Text>
        </Box>
      </Row>
      ))}
  </Box>
)

const Dropdowns = ({selectedUser, selectUser, selectedOption, selectOption, userIdx, optionIdx}) => (
  <Box style={{...globalStyles.flexBoxColumn}}>
    <Dropdown type='Username'
      value={selectedUser}
      options={['marcopolo', 'chris', 'cjb', 'bbbbbbbbbbbbbbbb']}
      onOther={() => selectUser('Chose someone else')}
      onClick={(selectedUser, idx) => selectUser(selectedUser, idx)}/>
    <Text type='Header'>Selected: {selectedUser} {userIdx}</Text>
    <Dropdown type={'General'}
      options={['one', 'two', 'three']}
      value={selectedOption}
      onClick={(selectedOption, idx) => selectOption(selectedOption, idx)}/>
    <Text type='Header'>Selected: {selectedOption} {optionIdx}</Text>
    <Dropdown type={'General'}
      options={['one', 'two', 'three']}
      value={selectedOption}
      onOther={() => console.log('Clicked on other')}
      onClick={(selectedOption, idx) => selectOption(selectedOption, idx)}/>
    <Text type='Header'>Selected: {selectedOption} {optionIdx}</Text>
    <Dropdown type={'General'}
      options={['one', 'two', 'three']}
      value={'two'}
      onOther={() => console.log('Clicked on other')}
      onClick={(selectedOption, idx) => selectOption(selectedOption, idx)}/>
    <Text type='Header'>Selected: Always two (testing selected w/o pick option)</Text>
  </Box>
)

const Icons = () => (
  <Box style={{...globalStyles.flexBoxColumn}}>
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
      <Row key={i}><Icon onClick={() => console.log('clicked')} type={i} /></Row>,
      <Row key={i + '100px'}><Icon style={{width: 100, height: 100}} onClick={() => console.log('clicked')} type={i} /></Row>
    ])}
    <Row key='a'><Icon type='fa-custom-copy' style={{color: globalColors.blue}}/></Row>
    <Row key='a1'><Icon type='fa-custom-copy' style={{color: globalColors.green}}/></Row>
    <Row key='a2'><Icon type='fa-custom-copy' style={{color: globalColors.orange}}/></Row>
  </Box>
)

const Inputs = () => (
  <Text type='Header'>TODO</Text>
)

const Checkboxes = ({check, flip}) => {
  return (
    <Box>
      {false && <Row><Switch onTintColor={globalColors.blue} value={check[0]} onValueChange={() => flip(0)}/></Row>}
      {false && <Row><Switch onTintColor={globalColors.blue} value={check[1]} onValueChange={() => flip(1)}/></Row>}
      <Row><Checkbox label='Switch unswitched' onCheck={() => flip(2)} checked={check[2]} disabled={false}/></Row>
      <Row><Checkbox label='Switch switched' onCheck={() => flip(3)} checked={check[3]} disabled={false}/></Row>
      <Row><Checkbox label='Switch unswitched disabled' onCheck={() => flip(4)} checked={check[4]} disabled/></Row>
      <Row><Checkbox label='Switch switched disabled' onCheck={() => flip(5)} checked={check[5]} disabled/></Row>
    </Box>
  )
}

export default class Render extends Component {
  state: {
    check: any, selectedUser: ?string, selectedOption: ?string, userIdx: number, optionIdx: number
  };

  constructor (props: any) {
    super(props)

    this.state = {
      check: [false, true, false, true, false, true],
      selectedUser: 'marcopolo',
      userIdx: -1,
      optionIdx: -1,
      selectedOption: null
    }
  }

  flip (idx: number) {
    const next = {...this.state.check}
    next[idx] = !next[idx]
    this.setState({check: next})
  }

  render () {
    // TODO: remove Success from here when dumb components sheet is in
    return (
      <ScrollView>
        <Container title='Success signup paperkey'>
          <Box style={{height: 660}}>
            <Success onFinish={() => {}} paperkey={new HiddenString('elephant bag candy asteroid laptop mug second archive pizza ring fish bumpy down')}/>
          </Box>
        </Container>
        <Container title='Dropdown'><Dropdowns
          selectedUser={this.state.selectedUser}
          selectUser={(selectedUser, userIdx) => this.setState({selectedUser, userIdx})}
          selectedOption={this.state.selectedOption}
          selectOption={(selectedOption, optionIdx) => this.setState({selectedOption, optionIdx})}
          userIdx={this.state.userIdx}
          optionIdx={this.state.optionIdx}
        /></Container>
        <Container title='Checkboxes'><Checkboxes flip={idx => this.flip(idx)} check={this.state.check}/></Container>
        <Container title='Icons'><Icons/></Container>
        <Container title='Buttons'><Buttons/></Container>
        <Container title='Text'><Fonts/></Container>
        <Container title='Colors'><Colors/></Container>
        <Container title='Inputs'><Inputs/></Container>
      </ScrollView>
    )
  }
}

