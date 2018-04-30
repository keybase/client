// @flow
import * as React from 'react'
import Box, {Box2} from './box'
import Text from './text'
import {storiesOf} from '../stories/storybook'
import {globalMargins, globalStyles, globalColors} from '../styles'

const load = () => {
  storiesOf('Common', module)
    .add('Box', () =>
      Object.keys(globalMargins).map(size => (
        <Box key={size} style={{...globalStyles.flexBoxRow, margin: 30, width: '100%'}}>
          <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-end', width: '50%'}}>
            <Box
              style={{
                borderColor: globalColors.grey,
                borderStyle: 'dashed',
                borderWidth: 2,
                height: globalMargins[size],
                marginRight: 24,
                width: globalMargins[size],
              }}
            />
          </Box>
          <Box style={{width: '50%'}}>
            <Text type="BodySmall">{size}: </Text>
            <Text type="BodySmall">{globalMargins[size]}px</Text>
          </Box>
        </Box>
      ))
    )
    .add('Box2', () => (
      <React.Fragment>
        <Holder label="Vertical" boxProps={{direction: 'vertical'}} />
        <Holder label="Vertical small gap" boxProps={{direction: 'vertical', gap: 'small'}} />
        <Holder
          label="Vertical small gap start"
          boxProps={{direction: 'vertical', gap: 'small', gapStart: true}}
        />
        <Holder
          label="Vertical small gap end"
          boxProps={{direction: 'vertical', gap: 'small', gapEnd: true}}
        />
        <Holder
          label="Vertical small gap both"
          boxProps={{direction: 'vertical', gap: 'small', gapEnd: true, gapStart: true}}
        />
        <Holder
          label="Vertical small gap full width"
          boxProps={{direction: 'vertical', fullWidth: true, gap: 'medium'}}
        />
        <Holder
          label="Vertical small gap full height"
          boxProps={{direction: 'vertical', fullHeight: true, gap: 'medium'}}
        />
        <Holder
          boxProps={{direction: 'vertical', fullHeight: true, fullWidth: true, gap: 'medium'}}
          label="Vertical small gap full height/width"
        />
        <Holder label="Horizontal" boxProps={{direction: 'horizontal'}} />
        <Holder label="Horizontal small gap" boxProps={{direction: 'horizontal', gap: 'small'}} />
        <Holder
          label="Horizontal small gap start"
          boxProps={{direction: 'horizontal', gap: 'small', gapStart: true}}
        />
        <Holder
          label="Horizontal small gap end"
          boxProps={{direction: 'horizontal', gap: 'small', gapEnd: true}}
        />
        <Holder
          label="Horizontal small gap both"
          boxProps={{direction: 'horizontal', gap: 'small', gapEnd: true, gapStart: true}}
        />
        <Holder
          label="Horizontal small gap full width"
          boxProps={{direction: 'horizontal', fullWidth: true, gap: 'medium'}}
        />
        <Holder
          label="Horizontal small gap full height"
          boxProps={{direction: 'horizontal', fullHeight: true, gap: 'medium'}}
        />
        <Holder
          boxProps={{direction: 'horizontal', fullHeight: true, fullWidth: true, gap: 'medium'}}
          label="Horizontal small gap full height/width"
        />
      </React.Fragment>
    ))
}

const LittleBox = () => <Box style={{backgroundColor: globalColors.red, height: 10, width: 10}} />
const HDivider = () => <Box style={{backgroundColor: globalColors.black, height: 1, width: '100%'}} />
const yellowStyle = {backgroundColor: globalColors.yellow}
const Holder = ({label, boxProps}) => (
  <React.Fragment>
    <Text type="BodySmall">{label}</Text>
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'flex-start',
        backgroundColor: globalColors.green,
        height: 200,
        width: 200,
      }}
    >
      <Box2 style={yellowStyle} {...boxProps}>
        <LittleBox key="1" />
        <LittleBox key="2" />
      </Box2>
    </Box>
    <HDivider />
  </React.Fragment>
)

export default load
