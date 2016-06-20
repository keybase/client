import React, {Component} from 'react'
import {StyleSheet, Image, TouchableHighlight, Text, View} from 'react-native'

import {services as serviceIcons} from '../constants/images'

const selectedColor = 'rgba(127, 127, 127, 0.2)'

export default class ScopeBar extends Component {
  render () {
    return (
      <View style={styles.bar}>
        <TouchableHighlight
          underlayColor={selectedColor}
          style={[styles.button, this.props.selectedService == null && styles.selectedButton]}
          onPress={() => this.props.onSelectService(null)}
        >
          <Image style={[styles.icon, styles.keybaseIcon]} source={serviceIcons.keybase} />
        </TouchableHighlight>
        <View style={styles.divider}>
          <Text>✚</Text>
        </View>
        {['twitter', 'github', 'reddit', 'coinbase', 'hackernews'].map(service => (
          <TouchableHighlight
            underlayColor={selectedColor}
            key={service}
            style={[styles.button, this.props.selectedService === service && styles.selectedButton]}
            onPress={() => this.props.onSelectService(this.props.selectedService === service ? null : service)}
          >
            <Image style={styles.icon} source={serviceIcons[service]} />
          </TouchableHighlight>
        ))}

      </View>
    )
  }
}

ScopeBar.propTypes = {
  selectedService: React.PropTypes.string,
  onSelectService: React.PropTypes.func.isRequired,
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    height: 45,
    paddingHorizontal: 10,
  },
  divider: {
    justifyContent: 'center',
  },
  button: {
    width: 36, height: 36,
    borderRadius: 18,
    marginHorizontal: 2,
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedButton: {
    backgroundColor: 'rgba(127, 127, 127, 0.4)',
  },
  icon: {
    width: 24, height: 24,
    borderRadius: 12,
  },
  keybaseIcon: {
    borderRadius: 0,
    overflow: 'visible',
  },
})
