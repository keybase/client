// @flow
import React from 'react'
import {Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import type {Props} from './choice-list'

const ChoiceList = ({options}: Props) => {
  return (
    <Box>
      <style>{rawCSS}</style>
      {options.map((op, idx) => (
        <Box style={styleEntry} key={idx} className='cl-entry' onClick={() => op.onClick()}>
          <Box style={styleIconContainer} className='cl-icon-container'>
          {typeof op.icon === 'string'
            ? <Icon style={styleIcon} type={op.icon} className='cl-icon' />
            : <Box style={styleIcon} className='cl-icon'>{op.icon}</Box>}
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
  .cl-entry {
    background-color: transparent;
  }
  .cl-entry:hover {
    background-color: ${globalColors.blue4};
  }

  .cl-icon {
    transform-origin: center center;
    transition: 0.5s transform;
  }
  .cl-entry:hover .cl-icon {
    transform: translateX(25%);
  }

  .cl-icon-container {
    transition: 0.5s background;
    background: ${globalColors.lightGrey};
    border-radius: 50%;
  }
  .cl-entry:hover .cl-icon-container {
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
  width: globalMargins.large + globalMargins.medium,
  height: globalMargins.large + globalMargins.medium,
}

const styleIcon = {
  width: globalMargins.large,
  height: globalMargins.large,
}

const styleInfoContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'left', // TODO (AW): invalid prop value
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
