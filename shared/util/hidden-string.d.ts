export class HiddenString {
  constructor(s: string)
  stringValue: () => string
  equals: (other: HiddenString) => boolean
}

export default HiddenString
