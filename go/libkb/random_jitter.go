package libkb

import (
	cryptorand "crypto/rand"
	"math/big"
	"time"
)

// RandomJitter takes a duration of d, and output a duration uniformly
// and randomly distributed in [.5d, 1.5d].
func RandomJitter(d time.Duration) (ret time.Duration, err error) {
	r := int64(100000)
	nBig, err := cryptorand.Int(cryptorand.Reader, big.NewInt(r))
	if err != nil {
		return ret, err
	}
	x := int64(d)
	n := nBig.Int64()

	ret = time.Duration(3*x/2 - x*n/r)
	return ret, nil
}
