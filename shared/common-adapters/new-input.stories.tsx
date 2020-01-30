import * as React from 'react'
import Box from './box'
import Icon, {IconType} from './icon'
import {action, storiesOf} from '../stories/storybook'
import {globalColors} from '../styles'
import NewInput from './new-input'

const Kb = {Icon, IconType}

const actions = {
  onBlur: action('onBlur'),
  onChangeText: action('onChangeText'),
  onClick: action('onClick'),
  onEndEditing: action('onEndEditing'),
  onEnterKeyDown: action('onEnterKeyDown'),
  onFocus: action('onFocus'),
  onKeyDown: action('onKeyDown'),
  onKeyUp: action('onKeyUp'),
}

const load = () => {
  storiesOf('Common/New input', module)
    .addDecorator(story => <Box style={{maxWidth: 400, padding: 10}}>{story()}</Box>)
    .add('Basic', () => <NewInput />)
    .add('Large text type', () => <NewInput textType="HeaderExtrabold" />)
    .add('With placeholder', () => <NewInput placeholder="Enter name here" />)
    .add('With actions', () => <NewInput placeholder="Type here to see actions" {...actions} />)
    .add('With icon', () => <NewInput placeholder="Search" icon={Kb.IconType.iconfont_search} />)
    .add('Large text w/ icon', () => (
      <NewInput textType="HeaderExtrabold" placeholder="Search" icon={Kb.IconType.iconfont_search} />
    ))
    .add('Multiline', () => <NewInput multiline={true} rowsMin={3} rowsMax={10} />)
    .add('With decoration', () => (
      <NewInput
        placeholder="Decor"
        decoration={
          <Icon
            type={Kb.Icon.makeFastType(Kb.IconType.iconfont_emoji)}
            style={{display: 'flex'}}
            color={globalColors.black_20}
            onClick={action('onClickEmoji')}
          />
        }
      />
    ))
    .add('Error state', () => <NewInput placeholder="Error" error={true} />)
    .add('Borderless', () => (
      <NewInput placeholder="Search" icon={Kb.IconType.iconfont_search} hideBorder={true} />
    ))
}

export default load
