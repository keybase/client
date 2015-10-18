package systests

import (
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/service"
	"testing"
)

func TestSignup(t *testing.T) {

	tc := setupTest(t, "signup")

	defer tc.Cleanup()

	stopCh := make(chan struct{})
	svc := service.NewService(false, tc.G)
	startCh := svc.GetStartChannel()
	go func() {
		if err := svc.Run(); err != nil {
			t.Fatal(err)
		}
		close(stopCh)
	}()

	tc2 := cloneContext(tc)
	stopper := client.NewCmdCtlStopRunner(tc2.G)
	<-startCh
	if err := stopper.Run(); err != nil {
		t.Fatal(err)
	}
	<-stopCh
}
