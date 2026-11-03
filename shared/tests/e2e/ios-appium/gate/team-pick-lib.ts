// Where the people search's pick stands, from the usernames its store holds (teamSoFar), for the
// add-members wizard (flows/teams-members.test.ts): the second account alone is 'picked', nothing is
// 'none', and anything else (someone else, or more than one) is 'stray', which no tap would fix.
export type PickState = 'none' | 'picked' | 'stray'

export const pickState = (picks: ReadonlyArray<string>, user: string): PickState =>
  !picks.length ? 'none' : picks.length === 1 && picks[0] === user ? 'picked' : 'stray'
