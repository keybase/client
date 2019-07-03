import * as React from 'react'
import * as Sb from '../stories/storybook'
import ListItem from './list-item2'
import {Box2} from './box'
import Text from './text'
import Icon from './icon'
import Button from './button'
import {globalColors} from '../styles'

const body1 = (
  <Box2 direction="vertical" style={{alignSelf: 'center', backgroundColor: globalColors.orange}}>
    <Text type="Body">Hello world</Text>
  </Box2>
)
const body2 = (
  <Box2 direction="vertical" style={{backgroundColor: globalColors.green, height: 100, width: 20}} />
)
const body3 = (
  <Box2 direction="vertical" style={{alignSelf: 'center', backgroundColor: globalColors.red}}>
    <Text type="Body">Hello world</Text>
    <Text type="BodySmall">Subtitle</Text>
  </Box2>
)
const actionButton = <Button label={'Action'} small={true} onClick={Sb.action('button')} />
const icon1 = <Icon type="icon-computer-32" />
const icon2 = <Icon type="icon-bitcoin-logo-48" />
const icon3 = <Icon type="iconfont-cloud" sizeType="Small" color={globalColors.blue} />

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('ListItem2', () => (
      <Box2 direction="vertical" style={{width: '100%'}}>
        <Text type="Header" style={{margin: 20}}>
          Small
        </Text>
        <ListItem firstItem={true} type="Small" icon={icon1} body={body1} />
        <ListItem firstItem={false} type="Small" body={body1} />
        <ListItem firstItem={false} type="Small" icon={icon1} body={body1} statusIcon={icon3} />
        <ListItem firstItem={false} type="Small" icon={icon1} body={body2} />
        <ListItem firstItem={false} type="Small" icon={icon1} body={body3} />
        <ListItem firstItem={false} type="Small" icon={icon1} body={body1} />
        <ListItem firstItem={false} type="Small" icon={icon1} body={body1} />
        <ListItem firstItem={false} type="Small" icon={icon1} body={body2} />
        <ListItem firstItem={false} type="Small" icon={icon2} body={body1} />
        <ListItem firstItem={false} type="Small" icon={icon1} body={body1} action={actionButton} />
        <ListItem
          firstItem={false}
          type="Small"
          icon={icon1}
          body={body1}
          action={actionButton}
          height={120}
        />
        <ListItem
          firstItem={false}
          icon={icon1}
          body={body1}
          type="Small"
          action={
            <Text style={{color: globalColors.redDark}} type={'BodySmall'} onClick={Sb.action('text action')}>
              Action Jack
            </Text>
          }
        />
        <Text type="Header" style={{margin: 20}}>
          Large
        </Text>
        <ListItem firstItem={true} type="Large" body={body1} />
        <ListItem firstItem={false} type="Large" icon={icon2} body={body1} action={actionButton} />
        <ListItem firstItem={false} type="Large" icon={icon1} body={body1} statusIcon={icon3} />
        <ListItem firstItem={false} type="Large" icon={icon2} body={body1} action={actionButton} />
        <ListItem firstItem={false} type="Large" icon={icon2} body={body1} action={actionButton} />
        <ListItem
          firstItem={false}
          type="Large"
          icon={icon2}
          body={body1}
          action={actionButton}
          height={120}
        />
        <ListItem firstItem={false} type="Large" icon={icon2} body={body1} action={actionButton} />
        <ListItem firstItem={false} type="Large" icon={icon1} body={body1} action={actionButton} />
      </Box2>
    ))
}

export default load
