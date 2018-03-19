// @flow
import {compose, withProps} from '../../../../util/container'
import type {Props, RetentionPolicy} from './'

const daysToItem = (days: number) => {
  let label = ''
  if (days > 0) {
    label = `${days} day`
    if (days > 1) {
      label += 's'
    }
  } else {
    label = 'Keep forever'
  }
  return {label, value: days}
}

const items = [1, 7, 30, 90, 365, -1].map(daysToItem)
const policyToDays = (policy: RetentionPolicy, parent?: RetentionPolicy) => {
  switch (policy.type) {
    case 'inherit':
      if (parent) {
        return policyToDays(parent)
      } else {
        throw new Error(`RetentionPicker: Got policy of type 'inherit' without an inheritable policy`)
      }
    case 'custom':
      return policy.days
  }
  return 0
}
const policyToItem = (policy: RetentionPolicy, parent?: RetentionPolicy) =>
  daysToItem(policyToDays(policy, parent))
const Hoc = compose(
  withProps((props: Props) => {
    let viewProps = {
      items,
      selectedItem: policyToItem(props.policy, props.teamPolicy),
    }
    if (props.teamPolicy) {
      const inheritType = policyToItem(props.teamPolicy)
      const teamItem = {label: `Use team default (${inheritType.label})`, value: 'inherit'}
      viewProps = {...viewProps, teamItem}
    }
    return viewProps
  })
)

export {Hoc}
