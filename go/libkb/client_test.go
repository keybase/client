package libkb

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestServerLookup(t *testing.T) {
	server, err := ServerLookup(NewEnv(nil, nil, makeLogGetter(t)), DevelRunMode)
	require.Equal(t, DevelServerURI, server)
	require.Equal(t, nil, err)

	server, err = ServerLookup(NewEnv(nil, nil, makeLogGetter(t)), StagingRunMode)
	require.Equal(t, StagingServerURI, server)
	require.Equal(t, nil, err)

	server, err = ServerLookup(NewEnv(nil, nil, makeLogGetter(t)), StagingRunMode)
	require.Equal(t, StagingServerURI, server)
	require.Equal(t, nil, err)

	server, err = ServerLookup(NewEnv(MockedConfig{NullConfiguration{}, true}, nil, makeLogGetter(t)), ProductionRunMode)
	require.Equal(t, ProductionServerURI, server)
	require.Equal(t, nil, err)

	server, err = ServerLookup(NewEnv(MockedConfig{NullConfiguration{}, false}, nil, makeLogGetter(t)), ProductionRunMode)
	require.Equal(t, ProductionSiteURI, server)
	require.Equal(t, nil, err)

	server, err = ServerLookup(NewEnv(MockedConfig{NullConfiguration{}, false}, nil, makeLogGetter(t)), NoRunMode)
	require.Equal(t, "", server)
	require.NotEqual(t, nil, err)
}
