import * as React from 'react'
import Box, {Box2} from './box'
import Text from './text'
import * as Sb from '../stories/storybook'
import {globalMargins, globalStyles, globalColors} from '../styles'

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Box', () =>
      Object.keys(globalMargins).map(size => (
        <Box key={size} style={{...globalStyles.flexBoxRow, margin: 30, width: '100%'}}>
          <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-end', width: '50%'}}>
            <Box
              style={{
                borderColor: globalColors.greyDark,
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
            <Text type="BodySmall">
              {globalMargins[size]}
              px
            </Text>
          </Box>
        </Box>
      ))
    )
    .add('Box2', () => (
      <React.Fragment>
        <Holder label="Vertical" boxProps={{direction: 'vertical'}} />
        <Holder
          label="Vertical centered children"
          boxProps={{centerChildren: true, direction: 'vertical', fullHeight: true, fullWidth: true}}
        />
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
          label="Vertical small gap full height/width"
          boxProps={{direction: 'vertical', fullHeight: true, fullWidth: true, gap: 'medium'}}
        />
        <Holder label="VerticalReverse" boxProps={{direction: 'verticalReverse'}} />
        <Holder
          label="VerticalReverse centered children"
          boxProps={{centerChildren: true, direction: 'verticalReverse', fullHeight: true, fullWidth: true}}
        />
        <Holder label="VerticalReverse small gap" boxProps={{direction: 'verticalReverse', gap: 'small'}} />
        <Holder
          label="VerticalReverse small gap start"
          boxProps={{direction: 'verticalReverse', gap: 'small', gapStart: true}}
        />
        <Holder
          label="VerticalReverse small gap end"
          boxProps={{direction: 'verticalReverse', gap: 'small', gapEnd: true}}
        />
        <Holder
          label="VerticalReverse small gap both"
          boxProps={{direction: 'verticalReverse', gap: 'small', gapEnd: true, gapStart: true}}
        />
        <Holder
          label="VerticalReverse small gap full width"
          boxProps={{direction: 'verticalReverse', fullWidth: true, gap: 'medium'}}
        />
        <Holder
          label="VerticalReverse small gap full height"
          boxProps={{direction: 'verticalReverse', fullHeight: true, gap: 'medium'}}
        />
        <Holder
          label="VerticalReverse small gap full height/width"
          boxProps={{direction: 'verticalReverse', fullHeight: true, fullWidth: true, gap: 'medium'}}
        />
        <Holder label="Horizontal" boxProps={{direction: 'horizontal'}} />
        <Holder
          label="Horizontal centered children"
          boxProps={{centerChildren: true, direction: 'horizontal', fullHeight: true, fullWidth: true}}
        />
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
          label="Horizontal small gap full height/width"
          boxProps={{direction: 'horizontal', fullHeight: true, fullWidth: true, gap: 'medium'}}
        />
        <Holder label="HorizontalReverse" boxProps={{direction: 'horizontalReverse'}} />
        <Holder
          label="HorizontalReverse centered children"
          boxProps={{centerChildren: true, direction: 'horizontalReverse', fullHeight: true, fullWidth: true}}
        />
        <Holder
          label="HorizontalReverse small gap"
          boxProps={{direction: 'horizontalReverse', gap: 'small'}}
        />
        <Holder
          label="HorizontalReverse small gap start"
          boxProps={{direction: 'horizontalReverse', gap: 'small', gapStart: true}}
        />
        <Holder
          label="HorizontalReverse small gap end"
          boxProps={{direction: 'horizontalReverse', gap: 'small', gapEnd: true}}
        />
        <Holder
          label="HorizontalReverse small gap both"
          boxProps={{direction: 'horizontalReverse', gap: 'small', gapEnd: true, gapStart: true}}
        />
        <Holder
          label="HorizontalReverse small gap full width"
          boxProps={{direction: 'horizontalReverse', fullWidth: true, gap: 'medium'}}
        />
        <Holder
          label="HorizontalReverse small gap full height"
          boxProps={{direction: 'horizontalReverse', fullHeight: true, gap: 'medium'}}
        />
        <Holder
          label="HorizontalReverse small gap full height/width"
          boxProps={{direction: 'horizontalReverse', fullHeight: true, fullWidth: true, gap: 'medium'}}
        />
        <Inside label="Inside flex start">
          <Box2 fullWidth={true} direction="vertical">
            <Box2 alignSelf="flex-start" direction="horizontal" style={{backgroundColor: 'red', width: 100}}>
              <Text type="BodySmall">Inside</Text>
            </Box2>
          </Box2>
        </Inside>
        <Inside label="Inside flex end">
          <Box2 fullWidth={true} direction="vertical">
            <Box2 alignSelf="flex-end" direction="horizontal" style={{backgroundColor: 'red', width: 100}}>
              <Text type="BodySmall">Inside</Text>
            </Box2>
          </Box2>
        </Inside>
      </React.Fragment>
    ))
}

const LittleBox = () => <Box style={{backgroundColor: globalColors.red, height: 10, width: 10}} />
const HDivider = () => <Box style={{backgroundColor: globalColors.black, height: 1, width: '100%'}} />
const yellowStyle = {backgroundColor: globalColors.yellow}

const Inside = ({label, children}) => (
  <>
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
      {children}
    </Box>
  </>
)
const Holder = ({label, boxProps}) => (
  <React.Fragment>
    <Inside label={label}>
      <Box2 style={yellowStyle} {...boxProps}>
        <LittleBox key="1" />
        <LittleBox key="2" />
      </Box2>
    </Inside>
    <HDivider />
  </React.Fragment>
)

export default load
