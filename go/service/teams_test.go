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
	token = "aazaaa0aaaaaaaaa"
	s = fmt.Sprintf("HELLO AND WELCOME TO THIS TEAM. token: %s", token)
	require.Equal(t, token, parseInviteToken(s))
	s = token
	require.Equal(t, token, parseInviteToken(s))
	s = fmt.Sprintf("%s %s", token, token)
	require.NotEqual(t, token, parseInviteToken(s))
	s = "token: MIKE"
	require.NotEqual(t, "MIKE", parseInviteToken(s))
	require.Equal(t, s, parseInviteToken(s))
	token = "87zaaa0aaa1zyaaz"
	s = fmt.Sprintf("invited to team 0123456789012345 with token: %s", token)
	require.Equal(t, token, parseInviteToken(s))
}
