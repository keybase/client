package engine

func IsLoggedIn(e Engine, ctx *Context) (bool, error) {
	if ctx.LoginContext != nil {
		return ctx.LoginContext.LoggedInLoad()
	}
	return e.G().LoginState().LoggedInLoad()
}
