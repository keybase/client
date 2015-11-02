package systests

import (
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/service"
	"testing"
)

func TestStop(t *testing.T) {

	tc := setupTest(t, "stop")

	defer tc.Cleanup()

	stopCh := make(chan error)
	svc := service.NewService(false, tc.G)
	startCh := svc.GetStartChannel()
	go func() {
		err := svc.Run()
		if err != nil {
			t.Logf("hit an error in Run, which might be masked: %v", err)
		}
		stopCh <- err
	}()

	tc2 := cloneContext(tc)

	<-startCh
	stopper := client.NewCmdCtlStopRunner(tc2.G)

	if err := stopper.Run(); err != nil {
		t.Fatal(err)
	}

	// If the server failed, it's also an error
	if err := <-stopCh; err != nil {
		t.Fatal(err)
	}
}
