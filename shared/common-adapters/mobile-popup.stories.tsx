import * as React from 'react'
import * as Styles from '../styles'
import * as Sb from '../stories/storybook'
import Text from './text'
import {Box2} from './box'
import Button from './button'
import NewInput from './new-input'
import MobilePopup from './mobile-popup'

const Kb = {
  Box2,
  Button,
  MobilePopup,
  NewInput,
  Text,
}

const load = () => {
  Sb.storiesOf('Common/Mobile popup', module)
    .add('Basic', () => (
      <Kb.MobilePopup>
        <Kb.Text type="Header" center={true}>
          Hello
        </Kb.Text>
      </Kb.MobilePopup>
    ))
    .add('Confirm popup', () => (
      <Kb.MobilePopup>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          style={Styles.padding(Styles.globalMargins.small)}
          gap="small"
        >
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
            <Kb.Text type="Header">Do the thing?</Kb.Text>
            <Kb.Text type="Body">
              If you do the thing you cannot undo the thing. Make sure you want to do the thing before you do
              the thing.
            </Kb.Text>
          </Kb.Box2>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
            <Kb.Button label="Do the thing" fullWidth={true} />
            <Kb.Button label="Close" type="Dim" fullWidth={true} />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.MobilePopup>
    ))
    .add('With keyboard', () => (
      <Kb.MobilePopup overlayStyle={Styles.globalStyles.fullHeight}>
        <Kb.NewInput placeholder="type here" />
      </Kb.MobilePopup>
    ))
}

export default load
