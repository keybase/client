import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Question1, Question2, VerificationChoice} from '.'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const props = {
  onSubmit: Sb.action('onSubmit'),
  voucheeUsername: 'weijiekohyalenus',
}

const errorProps = {
  error: 'You are offline.',
}

const load = () => {
  Sb.storiesOf('Profile/WotAuthor', module)
    .addDecorator(Sb.createPropProviderWithCommon())
    .add('Question1', () => <Question1 {...props} />)
    .add('Question2', () => <Question2 {...props} />)
    .add('Question1 error', () => <Question1 {...props} {...errorProps} />)
    .add('Question2 error', () => <Question2 {...props} {...errorProps} />)
    .add('xxx VerificationChoice', () => (
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <VerificationChoice
          voucheeUsername={props.voucheeUsername}
          verificationType={'audio'}
          selected={false}
          onSelect={() => {}}
        />
      </Kb.Box2>
    ))
    .add('xxx scratch', () => (
      <Kb.Box2 direction="vertical" style={{width: 190, height: 400, backgroundColor: '#ddd'}}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Box2
            key="spacer"
            direction="horizontal"
            fullWidth={true}
            style={{height: 50, backgroundColor: '#cfc'}}
          ></Kb.Box2>
          <Kb.Box2 direction="horizontal" alignSelf="stretch" alignItems="center">
            <Kb.Box2
              direction="vertical"
              alignSelf="stretch"
              style={{backgroundColor: 'blue', width: 6, flexShrink: 0}}
            ></Kb.Box2>
            <Kb.Box2 direction="horizontal" style={{backgroundColor: '#fcb'}}>
              {/* <Kb.RadioButton
              // label={
              //   <Kb.Text type="BodySmall" style={{backgroundColor: '#cfb'}}>
              //     xdebug debug debug debug debug debug debug debug debug debug debug debug debug debug debug debug
              //     debug debug debug debug debug debug
              //   </Kb.Text>
              // }
              // label="xdebug debug debug debug debug debug debug debug debug debug debug debug debug debug debug debug debug debug debug debug debug debug"
              selected={false}
              onSelect={() => {}}
              style={{
                paddingBottom: Styles.globalMargins.tiny,
                paddingLeft: Styles.globalMargins.small,
                paddingTop: Styles.globalMargins.tiny,
              }}
            /> */}
              <Kb.Text type="BodySmall" style={{backgroundColor: '#cbf'}}>
                xdebug debug debug debug debug debug debug debug debug debug debug debug debug debug debug
                debug debug debug debug debug debug debug
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    ))
}

export default load
