import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {Provider} from 'react-redux'
import {createStore, applyMiddleware} from 'redux'
import {GatewayProvider, GatewayDest} from 'react-gateway'
import {action} from '@storybook/addon-actions'
import Box from '../common-adapters/box'
import Text from '../common-adapters/text'
import ClickableBox from '../common-adapters/clickable-box'
import RandExp from 'randexp'
import * as PP from './prop-providers'

export type SelectorMap = {[K in string]: (arg0: any) => any | Object}

const unexpected = (name: string) => () => {
  throw new Error(`unexpected ${name}`)
}

// On mobile the GatewayDest wrapper needs to fill the entire screen, so we set fillAbsolute
// However on desktop, if the wrapper takes the full screen it will cover the other components
const styleDestBox = Styles.platformStyles({
  isElectron: {
    position: 'absolute',
  },
  isMobile: {
    ...Styles.globalStyles.fillAbsolute,
  },
})

// we set pointerEvents to 'box-none' so that the wrapping box will not catch
// touch events and they will be passed down to the child (popup)
class DestBox extends React.Component {
  render() {
    return <Kb.Box pointerEvents="box-none" style={styleDestBox} {...this.props} />
  }
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
// TODO remove this and move to use MockStore instead
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
  return (story: () => React.ReactNode) => (
    // @ts-ignore complains about merged
    <Provider
      key={`provider:${uniqueProviderKey++}`}
      store={
        // @ts-ignore
        createStore(state => state, merged)
      }
      merged={merged}
    >
      <GatewayProvider>
        <React.Fragment>
          <StorybookErrorBoundary children={story()} />
          <GatewayDest component={DestBox} name="popup-root" />
        </React.Fragment>
      </GatewayProvider>
    </Provider>
  )
}

// Plumb dispatches through storybook actions panel
const actionLog = () => next => a => {
  action('ReduxDispatch')(a)
  return next(a)
}

// Includes common old-style propProvider temporarily
export const MockStore = ({store, children}): any => (
  // @ts-ignore
  <Provider
    key={`storyprovider:${uniqueProviderKey++}`}
    store={createStore(state => state, {...store, ...PP.Common()}, applyMiddleware(actionLog))}
    merged={store}
  >
    <GatewayProvider>
      <React.Fragment>
        <StorybookErrorBoundary children={children} />
        <GatewayDest component={DestBox} name="popup-root" />
      </React.Fragment>
    </GatewayProvider>
  </Provider>
)
export const createNavigator = params => ({
  navigation: {
    getParam: key => params[key],
  },
})

class StorybookErrorBoundary extends React.Component<
  any,
  {
    hasError: boolean
    error: Error | null
    info: {
      componentStack: string
    } | null
  }
> {
  constructor(props: any) {
    super(props)
    this.state = {error: null, hasError: false, info: null}

    // Disallow catching errors when snapshot testing
    if (!__STORYSHOT__) {
      this.componentDidCatch = (
        error: Error,
        info: {
          componentStack: string
        }
      ) => {
        this.setState({error, hasError: true, info})
      }
    } else {
      this.componentDidCatch = undefined
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxColumn,
            borderColor: Styles.globalColors.red_75,
            borderStyle: 'solid',
            borderWidth: 2,
            padding: 10,
          }}
        >
          <Kb.Text type="Terminal" style={{color: Styles.globalColors.black, marginBottom: 8}}>
            🛑 An error occurred in a connected child component. Did you supply all props the child expects?
          </Kb.Text>
          <Kb.Box
            style={{
              ...Styles.globalStyles.flexBoxColumn,
              backgroundColor: Styles.globalColors.blueDarker2,
              borderRadius: Styles.borderRadius,
              padding: 10,
              whiteSpace: 'pre-line',
            }}
          >
            <Kb.Text type="Terminal" negative={true} selectable={true}>
              {this.state.error && this.state.error.toString()}
              {this.state.info && this.state.info.componentStack}
            </Kb.Text>
          </Kb.Box>
        </Kb.Box>
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
  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      this._seed = seed.split('').reduce((acc, _, i) => seed.charCodeAt(i) + acc, 0)
    } else {
      this._seed = seed
    }
  }

  next = () => {
    this._seed = (this._seed * 16807) % 2147483647
    return this._seed
  }

  // Inclusive
  randInt = (low: number, high: number) => (this.next() % (high + 1 - low)) + low

  generateString = (regex: RegExp): string => {
    const r = new RandExp(regex)
    r.randInt = this.randInt
    return r.gen()
  }
}

const scrollViewDecorator = (story: any) => (
  <Kb.ScrollView style={{height: '100%', width: '100%'}}>{story()}</Kb.ScrollView>
)

class PerfBox extends React.Component<
  {
    copiesToRender: number
    children: React.ReactNode
  },
  {
    key: number
  }
> {
  state = {key: 1}
  _text = null
  _startTime = 0
  _endTime = 0

  _incrementKey = () => {
    this.setState(old => ({key: old.key + 1}))
  }

  _updateTime = () => {
    this._endTime = this._getTime()
    const diff = this._endTime - this._startTime
    console.log('PerfTiming: ', diff)
  }

  _getTime = () => {
    // @ts-ignore
    const perf: any = window ? window.performance : undefined
    if (typeof perf !== 'undefined') {
      return perf.now()
    } else {
      return Date.now()
    }
  }

  render() {
    this._startTime = this._getTime()
    setTimeout(this._updateTime, 0)
    return (
      <Box key={this.state.key}>
        <ClickableBox onClick={this._incrementKey}>
          <Text type="Body">Refresh: #{this.state.key}</Text>
        </ClickableBox>
        {new Array(this.props.copiesToRender).fill(0).map((_, idx) => (
          <Box key={idx}>{this.props.children}</Box>
        ))}
      </Box>
    )
  }
}

const perfDecorator = (copiesToRender: number = 100) => (story: any) => (
  <PerfBox copiesToRender={copiesToRender}>{story()} </PerfBox>
)

// Used to pass extra props to a component in a story without flow typing
const propOverridesForStory = (p: any): {} => ({
  storyProps: p,
})

export {
  unexpected,
  createPropProvider,
  propOverridesForStory,
  StorybookErrorBoundary,
  Rnd,
  scrollViewDecorator,
  action,
  perfDecorator,
}
