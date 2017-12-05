package service

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseSeitanToken(t *testing.T) {
	token := "aazaaa0a+aaaaaaaa"
	s := fmt.Sprintf("HELLO AND WELCOME TO THIS TEAM. token: %s", token)
	require.Equal(t, token, parseInviteToken(s))
	s = token
	require.Equal(t, token, parseInviteToken(s))
	s = fmt.Sprintf("%s %s", token, token)
	require.NotEqual(t, token, parseInviteToken(s))
	s = "token: MIKE"
	require.NotEqual(t, "MIKE", parseInviteToken(s))
	require.Equal(t, s, parseInviteToken(s))
}
