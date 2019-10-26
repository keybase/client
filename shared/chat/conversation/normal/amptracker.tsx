export class AmpTracker {
  private numBuckets: number
  private buckets: Array<number> = []
  private curBucket = 0
  constructor(numBuckets: number) {
    this.numBuckets = numBuckets
  }

  addAmp = (amp: number) => {
    const samples = Math.floor(this.curBucket / this.numBuckets)
    const index = this.curBucket % this.numBuckets
    if (!samples) {
      this.buckets[index] = amp
    } else {
      let avg = this.buckets[index]
      avg -= avg / (samples + 1)
      avg += amp / (samples + 1)
      this.buckets[index] = avg
    }
    this.curBucket++
  }

  getBucketedAmps = (): Array<number> => {
    return this.buckets
  }

  reset = () => {
    this.buckets = []
    this.curBucket = 0
  }
}
