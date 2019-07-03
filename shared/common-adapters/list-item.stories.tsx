import * as React from 'react'
import * as Sb from '../stories/storybook'
import ListItem from './list-item'
import Box from './box'
import Text from './text'
import Button from './button'
import {globalColors} from '../styles'

const actionButton = <Button label={'Action'} small={true} onClick={Sb.action('button')} />
const load = () => {
  Sb.storiesOf('Common/ListItem', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Small with icon (desktop only)', () => (
      <ListItem
        type={'Small'}
        icon={<Box style={{backgroundColor: globalColors.black_20, height: 32, width: 32}} />}
        body={<Box style={{backgroundColor: globalColors.black_20, flex: 1}} />}
        action={actionButton}
      />
    ))
    .add('Small with button action', () => (
      <ListItem
        type={'Small'}
        swipeToAction={true}
        icon={<Box style={{backgroundColor: globalColors.black_20, height: 32, width: 32}} />}
        body={<Box style={{backgroundColor: globalColors.black_20, flex: 1}} />}
        action={actionButton}
      />
    ))
    .add('Small with text action', () => (
      <ListItem
        type={'Small'}
        icon={<Box style={{backgroundColor: globalColors.black_20, height: 32, width: 32}} />}
        body={<Box style={{backgroundColor: globalColors.black_20, flex: 1}} />}
        action={
          <Text style={{color: globalColors.redDark}} type={'BodySmall'} onClick={Sb.action('text action')}>
            Action Jack
          </Text>
        }
        swipeToAction={true}
        extraRightMarginAction={true}
      />
    ))
    .add('Large with Button', () => (
      <ListItem
        type={'Large'}
        icon={<Box style={{backgroundColor: globalColors.black_20, height: 48, width: 48}} />}
        body={<Box style={{backgroundColor: globalColors.black_20, flex: 1}} />}
        swipeToAction={true}
        action={actionButton}
      />
    ))
    .add('Large with text action', () => (
      <ListItem
        type={'Large'}
        icon={<Box style={{backgroundColor: globalColors.black_20, height: 48, width: 48}} />}
        body={<Box style={{backgroundColor: globalColors.black_20, flex: 1}} />}
        action={
          <Text style={{color: globalColors.redDark}} type={'BodySmall'} onClick={Sb.action('text action')}>
            Action Jack
          </Text>
        }
        extraRightMarginAction={true}
      />
    ))
}

export default load
