package systests

import (
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/service"
	"testing"
)

func TestSignup(t *testing.T) {
	t.Skip()

	tc := setupTest(t, "signup")

	defer tc.Cleanup()

	stopCh := make(chan error)
	svc := service.NewService(false, tc.G)
	startCh := svc.GetStartChannel()
	go func() {
		stopCh <- svc.Run()
	}()

	tc2 := cloneContext(tc)
	client.NewCmdSignupRunner(tc2.G)

	tc3 := cloneContext(tc)
	stopper := client.NewCmdCtlStopRunner(tc3.G)

	<-startCh
	if err := stopper.Run(); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}
