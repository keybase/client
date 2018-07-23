// @flow
import * as React from 'react'
import {Provider} from 'react-redux'
import {createStore} from 'redux'
import {GatewayProvider, GatewayDest} from 'react-gateway'
import {type SelectorMap} from './storybook'
import {Text, Box} from '../common-adapters'
import {platformStyles, globalColors, globalStyles} from '../styles'

const unexpected = (name: string) => () => {
  throw new Error(`unexpected ${name}`)
}

// On mobile the GatewayDest wrapper needs to fill the entire screen, so we set fillAbsolute
// However on desktop, if the wrapper takes the full screen it will cover the other components
const styleDestBox = platformStyles({
  isElectron: {
    position: 'absolute',
  },
  isMobile: {
    ...globalStyles.fillAbsolute,
  },
})

// we set pointerEvents to 'box-none' so that the wrapping box will not catch
// touch events and they will be passed down to the child (popup)
const DestBox = props => <Box pointerEvents="box-none" style={styleDestBox} {...props} />

/**
 * Creates a provider using a faux store of closures that compute derived viewProps
 * @param {SelectorMap} map an object of the form {DisplayName: Function(ownProps)} with
 *                          each closure returning the derived viewProps for the connected component
 * @returns {React.Node} a <Provider /> that creates a store from the supplied map of closures.
 *                       The Provider will ignore all dispatched actions. It also wraps the component
 *                       tree in an <ErrorBoundary /> that adds auxiliary info in case of an error.
 */
// Redux doesn't allow swapping the store given a single provider so we use a new key to force a new provider to
// work around this issue
let uniqueProviderKey = 1
const createPropProvider = (...maps: SelectorMap[]) => {
  const merged: SelectorMap = maps.reduce((obj, merged) => ({...obj, ...merged}), {})

  /*
   * GatewayDest and GatewayProvider need to be wrapped by the Provider here in
   * order for storybook to correctly mock connected components inside of
   * popups.
   * React.Fragment is used to render StorybookErrorBoundary and GatewayDest as
   * children to GatewayProvider which only takes one child
   */
  return (story: () => React.Node) => (
    <Provider key={`provider:${uniqueProviderKey++}`} store={createStore(state => state, merged)}>
      <GatewayProvider>
        <React.Fragment>
          <StorybookErrorBoundary children={story()} />
          <GatewayDest component={DestBox} name="popup-root" />
        </React.Fragment>
      </GatewayProvider>
    </Provider>
  )
}

class StorybookErrorBoundary extends React.Component<
  any,
  {hasError: boolean, error: ?Error, info: ?{componentStack: string}}
> {
  // $FlowIssue doesn't like us overriding the definition
  componentDidCatch: ?Function

  constructor(props: any) {
    super(props)
    this.state = {hasError: false, error: null, info: null}

    // Disallow catching errors when snapshot testing
    if (!__STORYSHOT__) {
      this.componentDidCatch = (error: Error, info: {componentStack: string}) => {
        this.setState({hasError: true, error, info})
      }
    } else {
      this.componentDidCatch = undefined
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            padding: 10,
            borderWidth: 2,
            borderColor: globalColors.red_75,
            borderStyle: 'solid',
          }}
        >
          <Text type="Terminal" style={{color: globalColors.black, marginBottom: 8}}>
            🛑 An error occurred in a connected child component. Did you supply all props the child expects?
          </Text>
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              backgroundColor: globalColors.darkBlue3,
              borderRadius: 4,
              padding: 10,
              whiteSpace: 'pre-line',
            }}
          >
            <Text type="Terminal" backgroundMode="Terminal" selectable={true}>
              {this.state.error && this.state.error.toString()}
              {this.state.info && this.state.info.componentStack}
            </Text>
          </Box>
        </Box>
      )
    }
    return this.props.children
  }
}

/**
 * Utilities for writing stories
 */

class Rnd {
  _seed = 0
  constructor(seed: number) {
    this._seed = seed
  }

  next = () => {
    this._seed = (this._seed * 16807) % 2147483647
    return this._seed
  }
}

export {unexpected, createPropProvider, StorybookErrorBoundary, Rnd}
