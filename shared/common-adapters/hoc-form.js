// @flow
/*
 * A high order component to wrap forms. We typically use this to shim connect calls to store values in the connected component
 * to skip states from flowing into the redux flow. We can store intermediate values and only submit them when we're actually
 * submitting (skip values as you type) or if you do want values to go as you type you can debounce them here
 */
import React, {Component} from 'react'
import _ from 'lodash'

export type ForHOCProps = {
  getFormValues: () => Object,
}

type FormInfo = {
  valueName: string,
  updateValueName: string,
  updateValueDebounce?: number, // Call the original update function in a debounced manner
  updateBeforeSubmitName?: string, // if there is a function that needs to be updated before
}

function HOCForm<P> (ComposedComponent: ReactClass<P>, ...infos: Array<FormInfo>): ReactClass<P & ForHOCProps> {
  class HOCForm extends Component<void, P, any> {
    state: any
    static parseRoute: ?() => void;

    constructor (props: any) {
      super(props)

      this.state = infos.reduce((map, info) => {
        map[info.valueName] = props[info.valueName] || ''
        map[info.updateValueName] = info.updateValueDebounce
          ? _.debounce(value => props[info.updateValueName](value), info.updateValueDebounce)
          : null
        return map
      }, {})
    }

    _updateValue (value: any, info: FormInfo) {
      console.log('HOC local update', value, info)
      this.setState({[info.valueName]: value})
      if (this.state[info.updateValueName]) {
        this.state[info.updateValueName](value)
      }
    }

    _updateBeforeSubmit (info: FormInfo, ...args: Array<any>) {
      // Update value first (not debounced)
      // $FlowIssue doesn't understand the computed property
      if (this.props[info.updateValueName]) {
        this.props[info.updateValueName](this.state[info.valueName])
      }

      // $FlowIssue doesn't understand the computed property
      this.props[info.updateBeforeSubmitName](...args)
    }

    _getFormValues = () => {
      return infos.reduce((map, info) => {
        map[info.valueName] = this.state[info.valueName]
        return map
      }, {})
    }

    render () {
      const newProps = {}
      infos.forEach(info => {
        newProps[info.updateValueName] = value => this._updateValue(value, info)
        newProps[info.valueName] = this.state[info.valueName]
        if (info.updateBeforeSubmitName) {
          newProps[info.updateBeforeSubmitName] = (...args) => this._updateBeforeSubmit(info, ...args)
        }
      })

      return <ComposedComponent {...this.props} {...newProps} getFormValues={this._getFormValues} />
    }
  }

  HOCForm.parseRoute = ComposedComponent.parseRoute
  return HOCForm
}

export default HOCForm
