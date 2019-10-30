export class AmpTracker {
  private numBuckets: number
  private buckets: Array<number> = []
  constructor(numBuckets: number) {
    this.numBuckets = numBuckets
  }

  addAmp = (amp: number) => {
    this.buckets.push(amp)
  }

  private bucketPass = (amps: Array<number>) => {
    let consumed = 0
    const res: Array<number> = []
    for (let i = 0; i < amps.length; i++) {
      if (amps.length - consumed > this.numBuckets && i < amps.length - 1) {
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

  getBucketedAmps = (): Array<number> => {
    let res: Array<number> = this.buckets
    for (let i = 0; i < 20; i++) {
      if (res.length <= this.numBuckets) {
        return res
      }
      res = this.bucketPass(res)
    }
    return res
  }

  reset = () => {
    this.buckets = []
  }
}
