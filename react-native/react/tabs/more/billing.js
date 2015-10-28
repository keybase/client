/* @flow */
'use strict'

import React, { Component, Text, View, StyleSheet } from 'react-native'

type PlanInfo = {
  isYourPlan: bool,
  planName: string,
  planInfo: string,
  price: number
}

export default class Billing extends Component {
  renderPlanRow (plan: PlanInfo, onMoreInfo: (plan: PlanInfo) => void) {
    const { isYourPlan, planName, planInfo, price } = plan
    return (
      <View style={styles.planRow}>
        <View style={[styles.planIcon, isYourPlan ? styles.activeIcon : {}]}>
          <Text style={{color: 'grey'}}>ICON</Text>
        </View>
        <View style={[styles.planInfo, isYourPlan ? styles.activePlan : {}]}>
          <View style={{flexDirection: 'column', justifyContent: 'center'}}>
            {isYourPlan && <Text style={{fontWeight: 'bold'}}>
              Your Plan
            </Text>}
            <Text>{planName}</Text>
            <Text>{planInfo} ${price}</Text>
          </View>
          <View style={styles.moreInfoWrapper}>
            <Text onPress={() => onMoreInfo(plan)}>Lorem Ipsum ></Text>
          </View>
        </View>
      </View>
    )
  }

  render () {
    const plans: Array<PlanInfo> = this.props.plans

    return (
      <View style={styles.container}>
        <View style={{flex: 0, paddingHorizontal: 20}}>
          <Text>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </Text>
        </View>
        <View style={{flex: 1, marginTop: 30}}>
          <View style={{height: 0, borderBottomWidth: 1}}/>
          {plans.map((plan) => this.renderPlanRow(plan, (p) => console.log('clicked: ', p)))}
        </View>
      </View>
    )
  }

  static parseRoute () {
    return {
      componentAtTop: {
        title: 'Billing',
        // Dummy data
        props: {
          plans: [{
            isYourPlan: true,
            planName: 'Small Folk',
            planInfo: 'Basically free',
            price: 0.00
          },
          { isYourPlan: false,
            planName: 'Knight',
            planInfo: 'A Title',
            price: 1.28
          },
          {isYourPlan: false,
            planName: 'Lord',
            planInfo: 'A Castle',
            price: 2.56}
          ]
        }
      }
    }
  }
}

Billing.propTypes = {
  plans: React.PropTypes.arrayOf(React.PropTypes.shape({
    isYourPlan: React.PropTypes.bool,
    planName: React.PropTypes.string,
    planInfo: React.PropTypes.string,
    price: React.PropTypes.number
  }))
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  planRow: {
    height: 80,
    flexDirection: 'row',
    borderBottomWidth: 1
  },
  activeIcon: {
    backgroundColor: 'black'
  },
  activePlan: {
    backgroundColor: 'grey'
  },
  planIcon: {
    justifyContent: 'center'
  },
  planInfo: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 20
  },
  moreInfoWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end'
  }
})
