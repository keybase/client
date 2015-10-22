'use strict'
/* @flow */

import React, { View, Text } from 'react-native'
import commonStyles from '../../styles/common'

export default function () {
  return (
    <View style={styles.container}>
    <Text style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Version 0.1</Text>
    </View>
  )
}
