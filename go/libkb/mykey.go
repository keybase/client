package libkb

// ShowKeys shows the status of your current KeyFamily.  For now, something
// very simple, just dump the info to the Log.  Eventually we'll want
// many more features here.
func ShowKeys(ui LogUI) (err error) {
	var user *User
	var ckf *ComputedKeyFamily
	if user, err = LoadMe(LoadUserArg{}); err != nil {
		return
	}
	if ckf = user.GetComputedKeyFamily(); ckf == nil {
		err = NoKeyError{"No computed key family found"}
		return
	}
	ckf.DumpToLog(ui)
	return
}
