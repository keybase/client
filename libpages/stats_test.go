package libpages

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type fileInfoForActivesGetterTest time.Time

func (f fileInfoForActivesGetterTest) Name() string       { return "" }
func (f fileInfoForActivesGetterTest) Size() int64        { return 0 }
func (f fileInfoForActivesGetterTest) Mode() os.FileMode  { return 0 }
func (f fileInfoForActivesGetterTest) ModTime() time.Time { return time.Time(f) }
func (f fileInfoForActivesGetterTest) IsDir() bool        { return false }
func (f fileInfoForActivesGetterTest) Sys() interface{}   { return nil }

func makeFileInfoActivesGetterForTest(
	tlfModTimes, hostModTimes []time.Time) fileinfoActivesGetter {
	tlfs := make([]os.FileInfo, 0, len(tlfModTimes))
	hosts := make([]os.FileInfo, 0, len(hostModTimes))
	for _, m := range tlfModTimes {
		tlfs = append(tlfs, fileInfoForActivesGetterTest(m))
	}
	for _, m := range hostModTimes {
		hosts = append(hosts, fileInfoForActivesGetterTest(m))
	}
	return fileinfoActivesGetter{
		tlfs:  tlfs,
		hosts: hosts,
	}
}

func TestGetActives(t *testing.T) {
	now := time.Now()
	getter := makeFileInfoActivesGetterForTest(
		[]time.Time{
			now.Add(-(time.Minute)),
			now.Add(-(time.Minute * 12)),
			now.Add(-(time.Hour + time.Minute)),
			now.Add(-(time.Hour*24 + time.Minute)),
			now.Add(-(time.Hour*24*7 + time.Minute)),
		}, // tlfs
		[]time.Time{
			now.Add(-(time.Minute)),
			now.Add(-(time.Minute * 12)),
			now.Add(-(time.Hour + time.Minute)),
			now.Add(-(time.Hour*24 + time.Minute)),
			now.Add(-(time.Hour*24*7 + time.Minute)),
		}, // hosts
	)
	tlfs, hosts, err := getter.GetActives(2 * time.Minute)
	require.NoError(t, err)
	require.Equal(t, 1, tlfs)
	require.Equal(t, 1, hosts)

	tlfs, hosts, err = getter.GetActives(time.Hour)
	require.NoError(t, err)
	require.Equal(t, 2, tlfs)
	require.Equal(t, 2, hosts)

	tlfs, hosts, err = getter.GetActives(time.Hour * 24)
	require.NoError(t, err)
	require.Equal(t, 3, tlfs)
	require.Equal(t, 3, hosts)

	tlfs, hosts, err = getter.GetActives(time.Hour * 24 * 7)
	require.NoError(t, err)
	require.Equal(t, 4, tlfs)
	require.Equal(t, 4, hosts)

	tlfs, hosts, err = getter.GetActives(time.Hour * 24 * 30)
	require.NoError(t, err)
	require.Equal(t, 5, tlfs)
	require.Equal(t, 5, hosts)
}
