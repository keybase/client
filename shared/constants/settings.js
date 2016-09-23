// @flow

export type PlanLevel = 'Basic' | 'Gold' | 'Friend'
const plans: Array<PlanLevel> = ['Basic', 'Gold', 'Friend']

export type PaymentInfo = {
  name: string,
  last4Digits: string,
  isBroken: boolean,
}

const levelToPrice: {[key: PlanLevel]: string} = {
  'Basic': 'Free',
  'Gold': '$7/mo',
  'Friend': '$9/mo',
}

const levelToPriceLong: {[key: PlanLevel]: string} = {
  'Basic': 'Free',
  'Gold': '$7/month',
  'Friend': '$9/month',
}

const levelToStars: {[key: PlanLevel]: number} = {
  'Basic': 1,
  'Gold': 3,
  'Friend': 5,
}

const levelToSpace: {[key: PlanLevel]: string} = {
  'Basic': '10GB',
  'Gold': '50GB',
  'Friend': '250GB',
}

function levelToDetails (p: PlanLevel) {
  return `You will be able to use up to ${levelToSpace[p]} of data`
}

// Compare weather another plan is an upgrade, downgrade or the same
// -1 : otherLevel is a downgrade from level
// 0 : otherLevel is the same as level
// 1 : otherLevel is an upgrade from level
function comparePlans (level: PlanLevel, otherLevel: PlanLevel): -1 | 0 | 1 {
  const levelIndex = plans.indexOf(level)
  const otherLevelIndex = plans.indexOf(otherLevel)
  if (levelIndex === otherLevelIndex) return 0
  if (levelIndex < otherLevelIndex) return 1
  if (levelIndex > otherLevelIndex) return -1

  // make flow happy
  return 0
}

export {
  comparePlans,
  levelToDetails,
  levelToPrice,
  levelToPriceLong,
  levelToSpace,
  levelToStars,
  plans,
}
