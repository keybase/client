package main

type UI struct {
}

type IdentifyUI struct {
}

func (u IdentifyUI) ReportHook() string {

}
func (u IdentifyUI) ShowWarnings(Warnings) {

}

func (u IdentifyUI) PromptForConfirmation(string) error {

}

func (u UI) GetIdentifyUI() IdentifyUI {
	return
}
