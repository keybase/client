// @flow
import React from 'react'
import {Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import type {Props} from './choice-list'

const ChoiceList = ({options}: Props) => {
  return (
    <Box>
      <style>{rawCSS}</style>
      {options.map((op, idx) => (
        <Box style={styleEntry} key={idx} className='choice-list__entry' onClick={() => op.onClick()}>
          <Box style={styleIconContainer} className='choice-list__entry__icon-ctnr'>
          {typeof op.icon === 'string'
            ? <Icon style={styleIcon} type={op.icon} className='choice-list__entry__icon-ctnr__icon' />
            : <Box style={styleIcon} className='choice-list__entry__icon-ctnr__icon'>{op.icon}</Box>}
          </Box>
          <Box style={styleInfoContainer}>
            <Text style={styleInfoTitle} type='Header'>{op.title}</Text>
            <Text style={styleInfoDescription} type='BodySmall'>{op.description}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  )
}

const rawCSS = `
  .choice-list__entry {
    background-color: transparent;
  }
  .choice-list__entry:hover {
    background-color: ${globalColors.blue4};
  }

  .choice-list__entry__icon-ctnr__icon {
    transform-origin: center center;
    transition: 0.5s transform;
  }
  .choice-list__entry:hover .choice-list__entry__icon-ctnr__icon {
    transform: translateX(25%);
  }

  .choice-list__entry__icon-ctnr {
    transition: 0.5s background;
    background: ${globalColors.lightGrey};
    border-radius: 50%;
  }
  .choice-list__entry:hover .choice-list__entry__icon-ctnr {
    background: transparent;
  }
`

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

export default ChoiceList
