// @flow
import {compose, withProps} from '../../../../util/container'
import type {RetentionPolicy} from '../../../../constants/types/teams'
import type {Props} from './'

const daysToItem = (days: number | 'retain') => {
  let label = ''
  if (days === 'retain') {
    label = 'Keep forever'
  } else if (days > 0) {
    label = `${days} day`
    if (days > 1) {
      label += 's'
    }
  }
  return {label, value: days}
}

const items = [1, 7, 30, 90, 365, 'retain'].map(daysToItem)
const policyToDays = (policy: RetentionPolicy, parent?: RetentionPolicy) => {
  switch (policy.type) {
    case 'inherit':
      if (parent) {
        return policyToDays(parent)
      } else {
        throw new Error(`RetentionPicker: Got policy of type 'inherit' without an inheritable policy`)
      }
    case 'expire':
      return policy.days
    case 'retain':
      return 'retain'
  }
  return 0
}
const policyToItem = (policy: RetentionPolicy, parent?: RetentionPolicy) =>
  daysToItem(policyToDays(policy, parent))
const Hoc = compose(
  withProps((props: Props) => {
    if (!props.policy) {
      return
    }
    let viewProps = {
      items,
      selectedItem: policyToItem(props.policy, props.teamPolicy),
    }
    if (props.teamPolicy) {
      const inheritItem = policyToItem(props.teamPolicy)
      const teamItem = {label: `Use team default (${inheritItem.label})`, value: 'inherit'}
      viewProps = {...viewProps, teamItem}
    }
    return viewProps
  })
)

export {Hoc}
