package flip

import (
	"github.com/stretchr/testify/require"
	"math/big"
	"testing"
)

func TestPRNG(t *testing.T) {
	var secret Secret
	secret[0] = 1
	prng := NewPRNG(secret)

	expected := []int{27, 47, 31, 22, 37, 39, 36, 58, 46, 6, 10, 60, 35, 48,
		51, 50, 46, 43, 34, 35, 18, 20, 60, 24, 58, 31, 59, 30, 37, 15, 24,
		3, 28, 4, 43, 30, 50, 30, 2, 28, 42, 46, 31, 44, 14, 25, 60, 15, 28,
		49, 4, 17, 6, 17, 33, 15, 44, 7, 34, 29, 12, 37, 8, 57, 29, 8, 26, 26,
		60, 22, 32, 62, 2, 51, 29, 43, 61, 37, 53, 15, 1, 12, 52, 34, 56, 29,
		50, 46, 6, 21, 39, 52, 41, 31, 59, 53, 47, 9, 44, 34,
	}

	for _, a := range expected {
		b := prng.Int(65)
		require.Equal(t, a, int(b))
	}

	n := "919209803230948230498223094203977777434098123"
	var ni big.Int
	ni.SetString(n, 10)
	bigExpected := []string{
		"190354259912800401095899520093223502878594970",
		"792897446862587984885220633297744013220280777",
		"158384316567582193269185588680412610068865943",
		"716602833405937701301118757350966138398343942",
		"47853333838735611526365454503076470246954124",
		"220216714913534392187513559698293232952678689",
		"505237317795713717327299348017831689208033996",
		"827157984911449364285145772497486776812351370",
		"332982993553527998619169441042405032003238558",
		"324411471198106435778561735596850933585002015",
	}

	for _, a := range bigExpected {
		b := prng.Big(&ni)
		var ai big.Int
		ai.SetString(a, 10)
		require.Equal(t, b.Cmp(&ai), 0)
	}

	coinsExpected := []bool{
		true, true, true, false, true, true, true, false, true, false, false, true,
		false, false, true, false, true, true, true, false,
	}

	for _, b := range coinsExpected {
		require.Equal(t, prng.Bool(), b)
	}
}
