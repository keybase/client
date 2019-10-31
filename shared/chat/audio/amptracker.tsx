export class AmpTracker {
  private numBuckets: number
  private buckets: Array<number> = []
  constructor(numBuckets: number) {
    this.numBuckets = numBuckets
  }

  addAmp = (amp: number) => {
    this.buckets.push(amp)
  }

  private bucketPass = (amps: Array<number>, maxBuckets: number) => {
    let consumed = 0
    const res: Array<number> = []
    for (let i = 0; i < amps.length; i++) {
      if (amps.length - consumed > maxBuckets && i < amps.length - 1) {
        res.push((amps[i] + amps[i + 1]) / 2)
        consumed += 2
        i++
      } else {
        res.push(amps[i])
        consumed++
      }
    }
    return res
  }

  getBucketedAmps = (duration: number): Array<number> => {
    const maxBuckets = Math.min(1, duration / 30000) * this.numBuckets
    let res: Array<number> = this.buckets
    for (let i = 0; i < 20; i++) {
      if (res.length <= maxBuckets) {
        return res
      }
      res = this.bucketPass(res, maxBuckets)
    }
    return res
  }

  reset = () => {
    this.buckets = []
  }
}
