package config

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseConfig(t *testing.T) {
	buf := &bytes.Buffer{}
	err := json.NewEncoder(buf).Encode(DefaultV1())
	require.NoError(t, err)
	parsed, err := ParseConfig(buf)
	require.NoError(t, err)
	require.Equal(t, DefaultV1(), parsed)
}
