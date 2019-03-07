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
	expected := []int{13, 59, 52, 48, 40, 15, 11, 21, 64, 31, 53, 61, 20, 28, 52, 41, 53, 45,
		54, 54, 23, 32, 19, 5, 53, 45, 18, 21, 13, 50, 57, 61, 26, 51, 62, 8, 62, 52, 10, 2, 64, 17,
		53, 35, 35, 9, 30, 0, 49, 47, 10, 8, 39, 37, 14, 18, 17, 48, 23, 32, 11, 45, 40, 24, 40, 11, 46, 40,
		46, 41, 3, 25, 16, 55, 16, 21, 8, 64, 22, 6, 9, 25, 49, 24, 12, 26, 48, 48, 28, 31, 34, 58, 21,
		28, 52, 60, 28, 50, 49, 8}

	for _, a := range expected {
		b := prng.Int(65)
		require.Equal(t, a, int(b))
	}

	n := "919209803230948230498223094203977777434098123"
	var ni big.Int
	ni.SetString(n, 10)
	bigExpected := []string{
		"614222739125617243553633697417534086505324514",
		"355554091485763233176715002468010576256365854",
		"445884861910366431685301365477451900735701042",
		"117678505521424886688566746877893336950051289",
		"246188573796042435697035169087245506434824132",
		"684500989680877379218341481720344136659405599",
		"26111147325353218353310266097685298806908568",
		"824789626433629860440209186185356370803493878",
		"831846934379293857466321253950305266684136426",
		"733199753439315108451154616131739206730983101",
	}

	for _, a := range bigExpected {
		b := prng.Big(&ni)
		var ai big.Int
		ai.SetString(a, 10)
		require.Equal(t, b.Cmp(&ai), 0)
	}

	coinsExpected := []bool{
		true, false, false, true, true, false, true, false, false, true, false, true, true, true, false, false,
		false, true, true, false,
	}

	for _, b := range coinsExpected {
		require.Equal(t, prng.Bool(), b)
	}

	expectedNegatives := []int{
		-210, -25, -224, -221, -64, -49, -64, -246, -76, -32, -159, -200, -49, -166, -23, -120, -164, -174, -205, -25, -26,
		-4, -31, -198, -176, -51, -244, -16, -81, -184, -141, -233, -197, -106, -101, -150, -191, -95, -147, -185, -249,
		-3, -132, -76, -212, -106, -224, -71, -217, -190, -11, -29, -176, -158, -163, -54, -234, -254, -164, -152, -48,
		-118, -53, -78, -116, -200, -141, -182, -156, -120, -45, -181, -191, -107, -246, -114, -244, -161, -33, -153,
		-182, -206, -213, -22, -230, -35, -38, -204, -29, -220, -196, -65, -52, -39, -122, -205, -181, -178, -60,
		-21, -120, -89, -129, -225, -34, -204, -134, -185, -50, -114, -55, -151, -239, -175, -43, -159, -64, -31,
		-74, -234, -100, -86, -175, -175, -82, -21, -26, -151, -63, -142, -116, -40, -87, -161, -143, -182, -18,
		-158, -59, -71, -216, -40, -65, -79, -243, -95, -12, -160, -63, -231, -56, -220, -70, -102, -61, -235,
		-21, -163, -174, -65, -45, -130, -113, -45, -156, -138, -158, -52, -150, -35, -17, -228, -22, -112, -199,
		-77, -168, -166, -16, -248, -39, -245, -110, -214, -28, -235, -54, -235, -160, -218, -133, -212, -139, -4,
		-64, -132, -233, -222, -194, -237, -149, -207, -161, -100, -36, -241, -70, -167, -252, -54, -42,
		-189, -234, -34, -192, -212, -49, -155, -189, -70, -62, -15, -114, -89, -234, -236, -21, -241, -217, -205,
		-155, -182, -103, -220, -143, -123, -82, -35, -15, -130, -140, -224, -158, -119, -2, -201, -195, -41, -246,
		-155, -156, -109, -41, -170, -142, -68, -28, -102, -176, -100, -213, -24, -46, -134, -191, -147, -178, -220,
		-116, -45, -53, -248, -177, -6, -168, -139, -52, -129, -95, -135, -116, -250, -32, -242, -127, -127, -234,
		-235, -92, -214, -243, -90, -11, -242, -150, -179, -218, -119, -156, -205, -204, -251, -143, -55, -15, -58,
		-78, -110, -241, -142, -1, -35, -81, -102, -107, -90, -53, -134, -246, -14, -249, -82, -217, -3, -197,
		-208, -64, -255, -202, -241, -70, -146, -20, -171, -182, -9, -213, -243, -221, -116, -171, -174, -121,
		-19, -148, -23, -137, -43, -144, -210, -112, -192, -171, -251, -134, -178, -63, 0, -180, -94, -52, -137}

	for _, a := range expectedNegatives {
		b := prng.Int(-256)
		require.Equal(t, a, int(b))
	}
}

func TestPRNGRanges(t *testing.T) {

	test := func(n int64) {
		var secret Secret
		secret[0] = 3
		found0 := false
		foundMax := false
		prng := NewPRNG(secret)
		max := n
		if max > 0 {
			max--
		} else {
			max++
		}

		for i := 0; i < 1000 && (!found0 || !foundMax); i++ {
			val := prng.Int(n)
			if val == 0 {
				found0 = true
			}
			if val == max {
				foundMax = true
			}
		}
		require.True(t, found0)
		require.True(t, foundMax)
	}

	for _, n := range []int{2, 4, 5, 16, 17, 32, 33, 64, 127, 128, 129, -2, -3, -4, -5, -8, -10, -15, -16, -17, -31, -32, -33} {
		test(int64(n))
	}
}

func TestPRNGCornerCases(t *testing.T) {
	var secret Secret
	secret[0] = 1
	prng := NewPRNG(secret)

	// By convention, we're returning 0 for 0 moduli, but it's
	// a corner case.
	m := big.NewInt(0)
	r := prng.Big(m)
	require.Equal(t, 0, m.Cmp(r))

	// The caase of the 1 modulus is handled normally but let's test
	// that it works.
	m = big.NewInt(1)
	r = prng.Big(m)
	require.Equal(t, 0, r.Cmp(big.NewInt(0)))

	// We had an earlier bug in our shuffle, a classic off-by-one, in which 0,1
	// would always be shuffled 1,0. So, if we run 40 times in a row, we better
	// get some number of (1,0) results that are >0 and <40. This test indeed
	// failed when I went back and rebroke the shuffle function.
	flips := 0
	n := 40
	for i := 0; i < n; i++ {
		res := prng.Permutation(2)
		if res[0] == 1 {
			flips++
		}
	}
	require.NotEqual(t, 0, flips)
	require.NotEqual(t, n, flips)
}
