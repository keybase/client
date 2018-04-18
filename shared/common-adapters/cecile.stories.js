// @flow
import * as React from 'react'
import Box from './box'
import Text from './text'
import {storiesOf} from '../stories/storybook'
import {globalStyles} from '../styles'
import {resolveImageAsURL} from '../desktop/resolve-root'

const avatarSizes = [12, 16, 24, 32, 40, 48, 64, 80, 112, 176]
const imageSizes = [40, 96, 192, 200, 360, 560]

const beards = imageSizes.map(i => `beard-${i}.jpg`)
const gals = imageSizes.map(i => `gal-${i}.png`)
const ill = imageSizes.map(i => `lll-${i}.jpg`)

const load = () => {
  storiesOf('Cecile', module).add('Images', () =>
    imageSizes.map((i, idx) => {
      return (
        <Box
          key={String(i)}
          style={{...globalStyles.flexBoxRow, margin: 30, width: '100%', flexWrap: 'wrap', padding: 20}}
        >
          <Text type="Body" style={{marginRight: 10}}>
            {i}
          </Text>
          <Wrap size={i} idx={idx} />
          <Box style={{width: '100%', height: 1, backgroundColor: 'grey'}} />
        </Box>
      )
    })
  )
}

const Wrap = ({idx, arr, size}) => {
  const style = {...globalStyles.flexBoxRow, width: size, height: size, alignItems: 'center'}
  const styleImage = {width: size}
  return (
    <React.Fragment>
      <Box style={{...wrapperStyle, ...style}}>
        <img src={resolveImageAsURL(beards[idx])} />
      </Box>
      <Box style={{...wrapperStyle, ...style}}>
        <img src={resolveImageAsURL(gals[idx])} />
      </Box>
      <Box style={{...wrapperStyle, ...style}}>
        <img src={resolveImageAsURL(ill[idx])} />
      </Box>
      {avatarSizes.map(a => {
        const style = {...globalStyles.flexBoxRow, width: a, height: a, alignItems: 'center'}
        const styleImage = {width: a}
        return (
          <Box key={String(a)}>
            <Text type="BodySmall" style={{marginRight: 5}}>
              {' '}
              {a}{' '}
            </Text>
            <Box style={{...wrapperStyle, ...style}}>
              <img src={resolveImageAsURL(beards[idx])} style={styleImage} />
            </Box>
            <Box style={{...wrapperStyle, ...style}}>
              <img src={resolveImageAsURL(gals[idx])} style={styleImage} />
            </Box>
            <Box style={{...wrapperStyle, ...style}}>
              <img src={resolveImageAsURL(ill[idx])} style={styleImage} />
            </Box>
          </Box>
        )
      })}
    </React.Fragment>
  )
}

const wrapperStyle = {
  margin: 2,
  borderRadius: '50%',
  overflow: 'hidden',
  flexShrink: 0,
}

export default load
