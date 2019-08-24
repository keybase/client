package avatars

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type apiAvatarRes struct {
	Status   libkb.AppStatus                                `json:"status"`
	Pictures []map[keybase1.AvatarFormat]keybase1.AvatarUrl `json:"pictures"`
}

func (a apiAvatarRes) GetAppStatus() *libkb.AppStatus {
	return &a.Status
}

type SimpleSource struct{}

func NewSimpleSource() *SimpleSource {
	return &SimpleSource{}
}

var _ Source = (*SimpleSource)(nil)

func (s *SimpleSource) StartBackgroundTasks(_ libkb.MetaContext) {}
func (s *SimpleSource) StopBackgroundTasks(_ libkb.MetaContext)  {}

func (s *SimpleSource) formatArg(formats []keybase1.AvatarFormat) string {
	var strs []string
	for _, f := range formats {
		strs = append(strs, f.String())
	}
	return strings.Join(strs, ",")
}

func (s *SimpleSource) apiReq(m libkb.MetaContext, endpoint, param string, names []string,
	formats []keybase1.AvatarFormat) (apiAvatarRes, error) {
	arg := libkb.NewAPIArg(endpoint)
	arg.Args = libkb.NewHTTPArgs()
	arg.SessionType = libkb.APISessionTypeOPTIONAL
	uarg := strings.Join(names, ",")
	farg := s.formatArg(formats)
	arg.Args.Add(param, libkb.S{Val: uarg})
	arg.Args.Add("formats", libkb.S{Val: farg})
	s.debug(m, "issuing %s avatar req: uarg: %s farg: %s", param, uarg, farg)
	var apiRes apiAvatarRes
	if err := m.G().API.GetDecode(m, arg, &apiRes); err != nil {
		s.debug(m, "apiReq: API fail: %s", err)
		return apiRes, err
	}
	return apiRes, nil
}

func (s *SimpleSource) makeRes(res *keybase1.LoadAvatarsRes, apiRes apiAvatarRes, names []string) error {
	if len(apiRes.Pictures) != len(names) {
		return fmt.Errorf("invalid API server response, wrong number of users: %d != %d",
			len(apiRes.Pictures), len(names))
	}
	allocRes(res, names)
	for index, rec := range apiRes.Pictures {
		u := names[index]
		for format, url := range rec {
			res.Picmap[u][format] = url
		}
	}
	return nil
}

func (s *SimpleSource) debug(m libkb.MetaContext, msg string, args ...interface{}) {
	m.Debug("Avatars.SimpleSource: %s", fmt.Sprintf(msg, args...))
}

func (s *SimpleSource) LoadUsers(m libkb.MetaContext, usernames []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer m.Trace("SimpleSource.LoadUsers", func() error { return err })()
	apiRes, err := s.apiReq(m, "image/username_pic_lookups", "usernames", usernames, formats)
	if err != nil {
		return res, err
	}
	if err = s.makeRes(&res, apiRes, usernames); err != nil {
		return res, err
	}
	return res, nil
}

func (s *SimpleSource) LoadTeams(m libkb.MetaContext, teams []string, formats []keybase1.AvatarFormat) (res keybase1.LoadAvatarsRes, err error) {
	defer m.Trace("SimpleSource.LoadTeams", func() error { return err })()
	apiRes, err := s.apiReq(m, "image/team_avatar_lookups", "team_names", teams, formats)
	if err != nil {
		return res, err
	}
	if err = s.makeRes(&res, apiRes, teams); err != nil {
		return res, err
	}
	return res, nil
}

func (s *SimpleSource) ClearCacheForName(m libkb.MetaContext, name string, formats []keybase1.AvatarFormat) (err error) {
	return nil
}

func (s *SimpleSource) OnDbNuke(m libkb.MetaContext) error { return nil }
