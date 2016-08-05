// @flow
import React from 'react'
import {Box, Text, Icon, Button} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import StandardScreen from './standard-screen'
import type {Props} from './choice-screen'

const ChoiceScreen = (props: Props) => {
  const {options, onCancel, title} = {...props}
  return (
    <StandardScreen onClose={onCancel}>
      <style>{rawCSS}</style>
      <Text style={styleTitle} type='Header'>{title}</Text>
      {options.map((op, idx) => (
        <Box style={styleEntry} key={idx} className='choice-screen__entry' onClick={() => op.onClick()}>
          <Box style={styleIconContainer} className='choice-screen__entry__icon-ctnr'>
          {typeof op.icon === 'string'
            ? <Icon style={styleIcon} type={op.icon} className='choice-screen__entry__icon-ctnr__icon' />
            : <Box style={styleIcon} className='choice-screen__entry__icon-ctnr__icon'>{op.icon}</Box>}
          </Box>
          <Box style={styleInfoContainer}>
            <Text style={styleInfoTitle} type='Header'>{op.title}</Text>
            <Text style={styleInfoDescription} type='BodySmall'>{op.description}</Text>
          </Box>
        </Box>
      ))}
      <Button style={styleCancelButton} type='Secondary' onClick={() => onCancel()} label={'Cancel'} />
    </StandardScreen>
  )
}

const rawCSS = `
  .choice-screen__entry {
    background-color: transparent;
  }
  .choice-screen__entry:hover {
    background-color: ${globalColors.blue4};
  }

  .choice-screen__entry__icon-ctnr__icon {
    transform-origin: center center;
    transition: 0.5s transform;
  }
  .choice-screen__entry:hover .choice-screen__entry__icon-ctnr__icon {
    transform: translateX(25%);
  }

  .choice-screen__entry__icon-ctnr {
    transition: 0.5s background;
    background: ${globalColors.lightGrey};
    border-radius: 50%;
  }
  .choice-screen__entry:hover .choice-screen__entry__icon-ctnr {
    background: transparent;
  }
`

const styleTitle = {
  marginBottom: globalMargins.medium,
}

const styleEntry = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  padding: `${globalMargins.tiny}px ${globalMargins.small}px`,
  width: '100%',
}

const styleIconContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  width: 80,
  height: 80,
}

const styleIcon = {
  width: 48,
  height: 48,
}

const styleInfoContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'left',
  textAlign: 'left',
  marginLeft: globalMargins.small,
}

const styleInfoTitle = {
  color: globalColors.blue,
}

const styleInfoDescription = {
  color: globalColors.black_40,
}

const styleCancelButton = {
  marginTop: globalMargins.medium,
}

export default ChoiceScreen
