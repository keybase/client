package engine

import (
	"fmt"
	"sync"
	"testing"
)

// TestConcurrentLogin tries calling logout, login, and many of
// the exposed methods in LoginState concurrently.  It is mainly
// useful when used with the -race flag.
func TestConcurrentLogin(t *testing.T) {
	tc := SetupEngineTest(t, "login")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(t, "login")

	var wg sync.WaitGroup

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(index int) {
			for j := 0; j < 10; j++ {
				G.LoginState.Logout()
				u.LoginOrBust(t)
			}
			fmt.Printf("logout/login #%d done\n", index)
			wg.Done()
		}(i)

		wg.Add(1)
		go func(index int) {
			for j := 0; j < 10; j++ {
				G.LoginState.SessionArgs()
				G.LoginState.UserInfo()
				G.LoginState.UID()
				G.LoginState.SessionLoad()
				G.LoginState.IsLoggedIn()
				G.LoginState.IsLoggedInLoad()
				G.LoginState.AssertLoggedIn()
				G.LoginState.AssertLoggedOut()
				G.LoginState.Shutdown()
				G.LoginState.GetCachedTriplesec()
				G.LoginState.GetCachedPassphraseStream()
			}
			wg.Done()
			fmt.Printf("func caller %d done\n", index)
		}(i)
	}

	wg.Wait()
}
