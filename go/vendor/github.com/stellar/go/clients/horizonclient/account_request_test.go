package horizonclient

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAccountRequestBuildUrl(t *testing.T) {
	ar := AccountRequest{}
	_, err := ar.BuildURL()

	// error case: No parameters
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "invalid request: no parameters")
	}

	ar.DataKey = "test"
	_, err = ar.BuildURL()

	// error case: few parameters for building account data endpoint
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "invalid request: too few parameters")
	}

	ar.DataKey = ""
	ar.AccountID = "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"
	endpoint, err := ar.BuildURL()

	// It should return valid account details endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU", endpoint)

	ar.DataKey = "test"
	ar.AccountID = "GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU"
	endpoint, err = ar.BuildURL()

	// It should return valid account data endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "accounts/GCLWGQPMKXQSPF776IU33AH4PZNOOWNAWGGKVTBQMIC5IMKUNP3E6NVU/data/test", endpoint)
}
