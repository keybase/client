'use strict'
/* @flow */

import React, { Text, View } from 'react-native'

export default function () {
  return (
    <View style={{flex: 1, justifyContent: 'center', backgroundColor: 'red'}}>
      <Text> Error! Tab name was not recognized</Text>
    </View>
  )
}
