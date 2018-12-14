package libkb

// HonorPGPExpireTime determines whether expiration time on PGP sigs should be honored
// during sigchain playback. For now, we don't see any reason not to, but we might
// find a situation in the future that makes PGP expiration times
// hard to work around. Return the expiration time (in seconds after the UTC Epoch)
// to "honor" it, and "0" to ignore it. So honor it.
func (g *GlobalContext) HonorPGPExpireTime(t int64) int64 { return t }

// HonorSigchainExpireTime determines whether expiration time on sigchain links should
// be honored or ignored. When keybase first started in 2014, there were some links
// that were intended to expire in 5 years. With the benefit of 5 years of expirience,
// we can now see little security rationale for this expiration, but tons of churn
// if we decided to force key rotations. So return "0" to mean we no longer will
// expire these keys automatically. They can of course be explicitly revoked. If you
// fork this client, feel free to return "t" meaning yes, honor the expiration time
// advertised in the sigchain. -- MK 2018.04.03
func (g *GlobalContext) HonorSigchainExpireTime(t int64) int64 { return int64(0) }
