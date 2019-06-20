import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../'
import * as Styles from '../../styles'
import {range} from 'lodash-es'
import Modal from '.'

const padding = Styles.padding(10)
const filler = (
  <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true} style={padding}>
    <Kb.Avatar size={64} />
    <Kb.Text type="Header">Header yada yada</Kb.Text>
  </Kb.Box2>
)

const leftButton = <Kb.Icon type="iconfont-arrow-left" onClick={Sb.action('onBack')} />
const rightButton = (
  <Kb.Button small={true} mode="Secondary" onClick={Sb.action('onClickMe')} label="Click me" />
)

const onClose = Sb.action('onClose')

const load = () => {
  Sb.storiesOf('Common/Modal', module)
    .addDecorator(Sb.createPropProviderWithCommon())
    .add('Default', () => (
      <Modal onClose={onClose}>
        <Kb.Box2 direction="vertical" style={padding}>
          <Kb.Text type="HeaderBig">I'm a modal.</Kb.Text>
        </Kb.Box2>
      </Modal>
    ))
    .add('Default max height', () => (
      <Modal onClose={onClose}>
        <Kb.Box2
          direction="vertical"
          style={{...Styles.globalStyles.flexBoxColumn, ...padding, backgroundColor: 'pink', height: 700}}
        >
          <Kb.Text type="HeaderBig">If your content is too big you'll scroll.</Kb.Text>
        </Kb.Box2>
      </Modal>
    ))
    .add('Header 1', () => (
      <Modal
        onClose={onClose}
        header={{
          leftButton,
          rightButton,
          title: (
            <Kb.Box2 direction="vertical" alignItems="center">
              <Kb.Text type="Header" lineClamp={1}>
                Title
              </Kb.Text>
              <Kb.Text type="BodyTiny">Subtitle</Kb.Text>
            </Kb.Box2>
          ),
        }}
      >
        {filler}
      </Modal>
    ))
    .add('Long title', () => (
      <Modal
        onClose={onClose}
        header={{
          leftButton,
          rightButton,
          title: (
            <Kb.Text type="Header" lineClamp={1}>
              I am a really long title, you might not see all of me.
            </Kb.Text>
          ),
        }}
      >
        {filler}
      </Modal>
    ))
    .add('Footer', () => (
      <Modal
        onClose={onClose}
        header={{
          leftButton,
          rightButton,
          title: (
            <Kb.Text type="Header" lineClamp={1}>
              Some kind of title
            </Kb.Text>
          ),
        }}
        footer={{
          children: <Kb.Button label="Primary" onClick={Sb.action('onClickPrimary')} fullWidth={true} />,
        }}
      >
        {filler}
      </Modal>
    ))
    .add('Header + Footer + Tall content', () => (
      <Modal
        onClose={onClose}
        header={{
          leftButton,
          rightButton,
          title: (
            <Kb.Text type="Header" lineClamp={1}>
              Some kind of title
            </Kb.Text>
          ),
        }}
        footer={{
          children: <Kb.Button label="Primary" onClick={Sb.action('onClickPrimary')} fullWidth={true} />,
          style: {backgroundColor: Styles.globalColors.blueGrey},
        }}
      >
        <Kb.Box2 direction="vertical" style={padding}>
          {range(0, 64).map(r => (
            <Kb.Box2
              direction="horizontal"
              key={r}
              fullWidth={true}
              style={{backgroundColor: generateColorFromSeed(r)}}
            >
              <Kb.Text type="Body">{r}</Kb.Text>
            </Kb.Box2>
          ))}
        </Kb.Box2>
      </Modal>
    ))
}

const generateColorFromSeed = s => `rgba(${s * 4}, ${s * 4}, ${s * 4}, 0.7)`

export default load
