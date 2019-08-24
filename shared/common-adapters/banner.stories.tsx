import * as React from 'react'
import {Box2} from './box'
import {Banner, BannerParagraph} from './banner'
import * as Sb from '../stories/storybook'

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Banner', () => (
      <Box2 direction="vertical" fullWidth={true} gap="small">
        <Banner key="1" color="red">
          This is a red banner with no action.
        </Banner>
        <Banner key="2" color="blue">
          This is a blue banner with no action.
        </Banner>
        <Banner key="3" color="yellow">
          This is a yellow banner with no action.
        </Banner>
        <Banner key="4" color="green">
          This is a green banner with no action.
        </Banner>
        <Banner key="5" color="grey">
          This is a grey banner with no action.
        </Banner>
        <Banner key="6" color="red">
          This is a red banner with super long text blah blah blah blah blah blah blah blah blah blah blah
          blah blah blah blah blah blah blah blah blah blah blah blah blah yes very long.
        </Banner>
        <Banner key="7" color="red" onClose={Sb.action('onClose')}>
          This is a red closable banner with super long text blah blah blah blah blah blah blah blah blah blah
          blah blah blah blah blah blah blah blah blah blah blah blah blah blah yes very long.
        </Banner>
        <Banner key="8" color="red" onClose={Sb.action('onClose')}>
          This is a closable red banner.
        </Banner>
        <Banner key="9" color="red" onClose={Sb.action('onClose')}>
          <BannerParagraph
            bannerColor="red"
            content={[
              'A banner with array content',
              null && 'not shown',
              ' and ',
              false && 'also not shown',
              'that has null and false inside.',
            ]}
          />
        </Banner>
        <Banner key="10" color="red" onClose={Sb.action('onClose')}>
          <BannerParagraph
            bannerColor="red"
            content={[
              'A banner with inline actions ',
              {onClick: Sb.action('action1'), text: 'action1'},
              ' and ',
              {onClick: Sb.action('action2'), text: 'action2'},
              ' and new line actions.',
            ]}
          />
          <BannerParagraph
            bannerColor="red"
            content={[
              {onClick: Sb.action('action3'), text: 'action3'},
              ', ',
              {onClick: Sb.action('action4'), text: 'action4'},
            ]}
          />
        </Banner>
        <Banner key="11" color="red" onClose={Sb.action('onClose')}>
          <BannerParagraph
            bannerColor="red"
            content={[
              'Here is a super long banner message with ',
              {onClick: Sb.action('action1'), text: 'action1'},
              ' and ',
              {onClick: Sb.action('action2'), text: 'action2'},
              '. Blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah.',
            ]}
          />
        </Banner>
      </Box2>
    ))
}

export default load
