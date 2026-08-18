package libkb

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestServerLookup(t *testing.T) {
	server, err := ServerLookup(NewEnv(nil, nil, makeLogGetter(t)), DevelRunMode)
	require.Equal(t, DevelServerURI, server)
	require.NoError(t, err)

	server, err = ServerLookup(NewEnv(nil, nil, makeLogGetter(t)), StagingRunMode)
	require.Equal(t, StagingServerURI, server)
	require.NoError(t, err)

	server, err = ServerLookup(NewEnv(nil, nil, makeLogGetter(t)), StagingRunMode)
	require.Equal(t, StagingServerURI, server)
	require.NoError(t, err)

	server, err = ServerLookup(NewEnv(MockedConfig{NullConfiguration{}, true}, nil, makeLogGetter(t)), ProductionRunMode)
	require.Equal(t, ProductionServerURI, server)
	require.NoError(t, err)

	server, err = ServerLookup(NewEnv(MockedConfig{NullConfiguration{}, false}, nil, makeLogGetter(t)), ProductionRunMode)
	require.Equal(t, ProductionSiteURI, server)
	require.NoError(t, err)

	server, err = ServerLookup(NewEnv(MockedConfig{NullConfiguration{}, false}, nil, makeLogGetter(t)), NoRunMode)
	require.Empty(t, server)
	require.Error(t, err)
}
