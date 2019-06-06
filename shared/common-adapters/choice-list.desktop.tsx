import * as React from 'react'
import {Box, Text, Icon, IconType} from '../common-adapters'
import {globalStyles, globalColors, globalMargins, desktopStyles} from '../styles'
import {Props} from './choice-list'

const ChoiceList = ({options}: Props) => {
  return (
    <Box>
      <style>{rawCSS}</style>
      {options.map((op, idx) => {
        // TODO is this okay?
        const iconType: IconType = op.icon as IconType
        return (
          <Box style={styleEntry} key={idx} className="cl-entry" onClick={() => op.onClick()}>
            <Box style={styleIconContainer} className="cl-icon-container">
              {typeof op.icon === 'string' ? (
                <Icon style={styleIcon} type={iconType} className="cl-icon" />
              ) : (
                <Box style={styleIcon} className="cl-icon">
                  {op.icon}
                </Box>
              )}
            </Box>
            <Box style={styleInfoContainer}>
              <Text type="BodyBigLink">{op.title}</Text>
              <Text type="Body">{op.description}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

const rawCSS = `
  .cl-entry {
    background-color: transparent;
  }
  .cl-entry:hover {
    background-color: ${globalColors.blueLighter2};
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
    background: ${globalColors.greyLight};
    border-radius: 50%;
  }
  .cl-entry:hover .cl-icon-container {
    background: transparent;
  }
`

const styleEntry = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  padding: `${globalMargins.tiny}px ${globalMargins.small}px`,
  width: '100%',
}

const styleIconContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  height: 80,
  justifyContent: 'center',
  width: 80,
}

const styleIcon = {
  height: 48,
  width: 48,
}

const styleInfoContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  flex: 1,
  justifyContent: 'center',
  marginLeft: globalMargins.small,
  textAlign: 'left',
}

export default ChoiceList
