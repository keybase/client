// Package price implements functions to ease working with stellar price values.
// At present, prices are only used within the offer system, and are represented
// by a fraction whose numberator and denominator are both 32-bit signed
// integers.
package price

import (
	"errors"
	"fmt"
	"math"
	"math/big"
	"regexp"
	"strconv"

	"github.com/stellar/go/xdr"
)

var (
	// validAmountSimple is a simple regular expression checking if a string looks like
	// a number, more or less. The details will be checked in `math/big` internally.
	// What we want to prevent is passing very big numbers like `1e9223372036854775807`
	// to `big.Rat.SetString` triggering long calculations.
	// Note: {1,20} because the biggest amount you can use in Stellar is:
	// len("922337203685.4775807") = 20.
	validAmountSimple = regexp.MustCompile("^-?[.0-9]{1,20}$")
)

// Parse  calculates and returns the best rational approximation of the given
// real number price while still keeping both the numerator and the denominator
// of the resulting value within the precision limits of a 32-bit signed
// integer..
func Parse(v string) (xdr.Price, error) {
	return continuedFraction(v)
}

// continuedFraction calculates and returns the best rational approximation of
// the given real number.
func continuedFraction(price string) (xdrPrice xdr.Price, err error) {
	if !validAmountSimple.MatchString(price) {
		return xdrPrice, fmt.Errorf("invalid price format: %s", price)
	}

	number := &big.Rat{}
	maxInt32 := &big.Rat{}
	zero := &big.Rat{}
	one := &big.Rat{}

	_, ok := number.SetString(price)
	if !ok {
		return xdrPrice, fmt.Errorf("cannot parse price: %s", price)
	}

	maxInt32.SetInt64(int64(math.MaxInt32))
	zero.SetInt64(int64(0))
	one.SetInt64(int64(1))

	fractions := [][2]*big.Rat{
		{zero, one},
		{one, zero},
	}

	i := 2
	for {
		if number.Cmp(maxInt32) == 1 {
			break
		}

		f := &big.Rat{}
		h := &big.Rat{}
		k := &big.Rat{}

		a := floor(number)
		f.Sub(number, a)
		h.Mul(a, fractions[i-1][0])
		h.Add(h, fractions[i-2][0])
		k.Mul(a, fractions[i-1][1])
		k.Add(k, fractions[i-2][1])

		if h.Cmp(maxInt32) == 1 || k.Cmp(maxInt32) == 1 {
			break
		}

		fractions = append(fractions, [2]*big.Rat{h, k})
		if f.Cmp(zero) == 0 {
			break
		}
		number.Quo(one, f)
		i++
	}

	n, d := fractions[len(fractions)-1][0], fractions[len(fractions)-1][1]

	if n.Cmp(zero) == 0 || d.Cmp(zero) == 0 {
		return xdrPrice, errors.New("Couldn't find approximation")
	}

	return xdr.Price{
		N: xdr.Int32(n.Num().Int64()),
		D: xdr.Int32(d.Num().Int64()),
	}, nil
}

func floor(n *big.Rat) *big.Rat {
	f := &big.Rat{}
	z := new(big.Int)
	z.Div(n.Num(), n.Denom())
	f.SetInt(z)
	return f
}

//StringFromFloat64 will format a float64 to decimal representation with 7 digits after the decimal point
func StringFromFloat64(v float64) string {
	return strconv.FormatFloat(v, 'f', 7, 64)
}
