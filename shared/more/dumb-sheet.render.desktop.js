import React, {Component} from 'react'
import {Box, Text} from '../common-adapters'
import {globalStyles} from '../styles/style-guide'
import type {DumbMap} from './dumb'

import CommonMap from '../common-adapters/dumb'
import LoginMap from '../login/dumb'
import SignupMap from '../login/signup/dumb'
import TrackerMap from '../tracker/dumb'
import PinentryMap from '../pinentry/dumb'

class Render extends Component {
  render () {
    const componentMap: DumbMap = {
      ...CommonMap,
      ...LoginMap,
      ...SignupMap,
      ...TrackerMap,
      ...PinentryMap
    }

    return (
      <Box style={{flex: 1, padding: 20}}>
        {Object.keys(componentMap).map(key => {
          const map = componentMap[key]
          // $FlowIssue TODO
          const Component = map.component
          return (
            <Box style={styleBox}>
              <Text type='Header' style={{marginBottom: 5}}>{key}</Text>
              {Object.keys(map.mocks).map((mockKey, idx) => {
                const mock = {...map.mocks[mockKey]}
                const parentProps = mock.parentProps
                mock.parentProps = undefined

                return (
                  <Box style={styleBox}>
                    <Text type='Body' style={{marginBottom: 5}}>{mockKey}</Text>
                    <Box {...parentProps}>
                      <Component key={mockKey} {...mock} />
                    </Box>
                  </Box>
                  )
              })}
            </Box>
            )
        })}
      </Box>
    )
  }
}

const styleBox = {
  ...globalStyles.flexBoxColumn,
  padding: 20,
  marginTop: 10,
  border: 'solid 1px lightgray',
  boxShadow: '5px 5px lightgray'
}

export default Render
