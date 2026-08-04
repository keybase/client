package libpages

import (
	"net/http"
	"testing"

	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

type showtrendsTestClient struct {
	counts []string
}

func (c *showtrendsTestClient) CountOne(name string) {
	c.counts = append(c.counts, name)
}

func (*showtrendsTestClient) Value(string, float64) {}

func TestShowtrendsReporter(t *testing.T) {
	client := new(showtrendsTestClient)
	reporter := newShowtrendsReporter(zap.NewNop(), "kbp -", client, nil)
	reporter.ReportServedRequest(&ServedRequestInfo{
		Proto:         "HTTP/2.0",
		Authenticated: true,
		TlfType:       tlf.Public,
		RootType:      GitRoot,
		HTTPStatus:    http.StatusOK,
		CloningShown:  true,
		InvalidConfig: true,
	})

	require.Equal(t, []string{
		"kbp - requests",
		"kbp - proto:HTTP/2.0",
		"kbp - status:200",
		"kbp - authenticated",
		"kbp - cloningShown",
		"kbp - invalidConfig",
		"kbp - tlfType:public",
		"kbp - rootType:git",
	}, client.counts)
}
