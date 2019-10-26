export class AmpTracker {
  private numBuckets: number
  constructor(numBuckets) {
    this.numBuckets = numBuckets
  }

  addAmp = (amp: number) => {}

  getBucketedAmps = (): Array<number> => {
    return []
  }
}
