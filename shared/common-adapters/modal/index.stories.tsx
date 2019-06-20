import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../'
import * as Styles from '../../styles'
import Modal from '.'

const filler = (
  <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true}>
    <Kb.Avatar size={64} />
    <Kb.Text type="Header">Header yada yada</Kb.Text>
  </Kb.Box2>
)

const onClose = Sb.action('onClose')

const load = () => {
  Sb.storiesOf('Common/Modal', module)
    .addDecorator(Sb.createPropProviderWithCommon())
    .add('Default', () => (
      <Modal onClose={onClose}>
        <Kb.Text type="HeaderBig">Hey I'm modal, nice to meet you.</Kb.Text>
      </Modal>
    ))
    .add('Default max height', () => (
      <Modal onClose={onClose}>
        <Kb.Box2
          direction="vertical"
          style={{...Styles.globalStyles.flexBoxColumn, backgroundColor: 'pink', height: 700}}
        >
          <Kb.Text type="HeaderBig">If your content is too big you'll scroll.</Kb.Text>
        </Kb.Box2>
      </Modal>
    ))
    .add('Header 1', () => (
      <Modal
        onClose={onClose}
        header={{
          rightButton: (
            <Kb.Button small={true} mode="Secondary" onClick={Sb.action('onClickMe')} label="Click me" />
          ),
          title: (
            <Kb.Box2 direction="vertical" alignItems="center">
              <Kb.Text type="Header">Title</Kb.Text>
              <Kb.Text type="BodyTiny">Subtitle</Kb.Text>
            </Kb.Box2>
          ),
        }}
      >
        {filler}
      </Modal>
    ))
}

export default load
