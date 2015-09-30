'use strict'
/* @flow */

import { StyleSheet } from 'react-native'

export default StyleSheet.create({
  button: {
    textAlign: 'center',
    color: 'black',
    marginBottom: 10,
    padding: 10,
    borderColor: 'blue',
    borderRadius: 2,
    backgroundColor: '#eeeeee'
  },
  actionButton: {
    textAlign: 'center',
    color: 'black',
    marginBottom: 10,
    padding: 10,
    borderColor: 'blue',
    borderRadius: 2,
    backgroundColor: '#5E80FF'
  },
  error: {
    backgroundColor: 'red',
    color: 'black'
  },
  h1: {
    fontSize: 18
  },
  h2: {
    fontSize: 16
  },
  separator: {
    height: 1,
    backgroundColor: '#CCCCCC'
  }
})

// non stylesheet styles
export const buttonHighlight = 'white'
