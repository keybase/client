// @flow

import {Component, Children, PropTypes} from 'react'

// Implement Provider with a given piece of state
export default class Mock extends Component {
  store: any;
  _implementMockStore (state: Object): any {
    return {
      getState: () => state,
      dispatch: a => console.log('Mock Dispatching:', a),
      subscribe: l => {},
      replaceReducer: () => {},
    }
  }

  getChildContext (): any {
    return {store: this.store}
  }

  constructor (props: any, context: any) {
    super(props, context)
    this.store = this._implementMockStore(props.state)
  }

  render (): any {
    const {children} = this.props
    return Children.only(children)
  }
}

Mock.childContextTypes = {
  store: PropTypes.shape({
    subscribe: PropTypes.func.isRequired,
    dispatch: PropTypes.func.isRequired,
    getState: PropTypes.func.isRequired,
  }),
}
