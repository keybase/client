// @flow
import * as React from 'react'
import ListItem from './list-item'
import Box from './box'
import Text from './text'
import Button from './button'
import {action, storiesOf} from '../stories/storybook'
import {globalColors} from '../styles'

const actionButton = <Button label={'Action'} type={'Primary'} small={true} onClick={action('button')} />
const load = () => {
  storiesOf('Common/ListItem', module)
    .add('Small with icon (desktop only)', () => (
      <ListItem
        type={'Small'}
        icon={<Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />}
        body={<Box style={{backgroundColor: globalColors.black_20, flex: 1}} />}
        action={actionButton}
      />
    ))
    .add('Small with button action', () => (
      <ListItem
        type={'Small'}
        swipeToAction={true}
        icon={<Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />}
        body={<Box style={{backgroundColor: globalColors.black_20, flex: 1}} />}
        action={actionButton}
      />
    ))
    .add('Small with text action', () => (
      <ListItem
        type={'Small'}
        icon={<Box style={{height: 32, width: 32, backgroundColor: globalColors.black_20}} />}
        body={<Box style={{backgroundColor: globalColors.black_20, flex: 1}} />}
        action={
          <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={action('text action')}>
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
        icon={<Box style={{height: 48, width: 48, backgroundColor: globalColors.black_20}} />}
        body={<Box style={{backgroundColor: globalColors.black_20, flex: 1}} />}
        swipeToAction={true}
        action={actionButton}
      />
    ))
    .add('Large with text action', () => (
      <ListItem
        type={'Large'}
        icon={<Box style={{height: 48, width: 48, backgroundColor: globalColors.black_20}} />}
        body={<Box style={{backgroundColor: globalColors.black_20, flex: 1}} />}
        action={
          <Text style={{color: globalColors.red}} type={'BodySmall'} onClick={action('text action')}>
            Action Jack
          </Text>
        }
        extraRightMarginAction={true}
      />
    ))
}

export default load
