// @flow
import * as React from 'react'
import {Provider} from 'react-redux'
import {createStore} from 'redux'
import {type SelectorMap} from './storybook'
import {Text, Box} from '../common-adapters'
import {globalColors, globalStyles} from '../styles'

const unexpected = (name: string) => () => {
  throw new Error(`unexpected ${name}`)
}

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
const createPropProvider = (map: SelectorMap) => (story: () => React.Node) => (
  <Provider key={`provider:${uniqueProviderKey++}`} store={createStore(state => state, map)}>
    <StorybookErrorBoundary children={story()} />
  </Provider>
)

class StorybookErrorBoundary extends React.Component<
  any,
  {hasError: boolean, error: ?Error, info: ?{componentStack: string}}
> {
  constructor(props: any) {
    super(props)
    this.state = {hasError: false, error: null, info: null}

    // Disallow catching errors when snapshot testing
    if (!__STORYSHOT__) {
      this.componentDidCatch = (error: Error, info: {componentStack: string}) => {
        this.setState({hasError: true, error, info})
      }
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
export {unexpected, createPropProvider, StorybookErrorBoundary}
