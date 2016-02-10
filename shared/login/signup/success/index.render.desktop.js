/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalStyles} from '../../../styles/style-guide'
import {Text} from '../../../common-adapters'

import type {Props} from './index.render'

export default class Render extends Component {
  props: Props;

  render (): ReactElement {
    return (

      <div style={styles.form}>
      <Text type='header'>{`Success! you're in`}</Text>
      </div>
    )
  }
}

const styles = {
  form: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },

  topMargin: {
    marginTop: 20
  }
}
