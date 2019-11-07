package horizonclient

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSubmitRequestBuildUrl(t *testing.T) {
	sr := submitRequest{endpoint: "transactions", transactionXdr: "xyzabc"}
	endpoint, err := sr.BuildURL()

	// It should return valid endpoint and no errors
	require.NoError(t, err)
	assert.Equal(t, "transactions?tx=xyzabc", endpoint)

	sr = submitRequest{}
	_, err = sr.BuildURL()

	// It should return errors
	if assert.Error(t, err) {
		assert.Contains(t, err.Error(), "invalid request: too few parameters")
	}
}
