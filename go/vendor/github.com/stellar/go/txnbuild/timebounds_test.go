package txnbuild

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTimeboundsRequireConstructor(t *testing.T) {
	tb := Timebounds{MinTime: -1, MaxTime: 300}
	err := tb.Validate()
	expectedErrMsg := "timebounds must be constructed using NewTimebounds(), NewTimeout(), or NewInfiniteTimeout()"

	require.EqualError(t, err, expectedErrMsg, "Default timebounds not allowed")
}

func TestSetTimeboundsNegativeMinTime(t *testing.T) {
	tb := NewTimebounds(-1, 300)
	err := tb.Validate()
	expectedErrMsg := "invalid timebound: minTime cannot be negative"

	require.EqualError(t, err, expectedErrMsg, "No negative minTime allowed")
}

func TestSetTimeboundsNegativeMaxTime(t *testing.T) {
	tb := NewTimebounds(1, -300)
	err := tb.Validate()
	expectedErrMsg := "invalid timebound: maxTime cannot be negative"

	require.EqualError(t, err, expectedErrMsg, "No negative maxTime allowed")
}

func TestSetTimeoutNegativeWidth(t *testing.T) {
	tb := NewTimeout(300)
	tb.MinTime = 5555624032 // Sometime in 2146
	err := tb.Validate()
	expectedErrMsg := "invalid timebound: maxTime < minTime"

	require.EqualError(t, err, expectedErrMsg, "No negative width windows")
}

func TestSetTimeout(t *testing.T) {
	tb := NewTimeout(300)
	tb.MinTime = 1
	err := tb.Validate()
	if assert.NoError(t, err) {
		assert.Equal(t, int64(1), tb.MinTime)
		assert.NotNil(t, tb.MaxTime)
	}
}
