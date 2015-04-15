package libkb

type UserInfo struct {
	Uid      UID
	Username string
}

type CurrentStatus struct {
	Configured bool
	Registered bool
	LoggedIn   bool
	User       *User
}

func GetCurrentStatus() (res CurrentStatus, err error) {
	if cr := G.Env.GetConfig(); cr == nil {
	} else {
		res.Configured = true
		if u := cr.GetUID(); u != nil {
			res.Registered = true
			res.User = NewUserThin(cr.GetUsername(), *u)
		}
		res.LoggedIn, err = G.LoginState.IsLoggedInLoad()
	}
	return
}
