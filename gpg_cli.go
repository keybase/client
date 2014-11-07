package libkb

type GpgCLI struct {
	path    string
	options []string

	// Configuration --- cache the results
	configured  bool
	configFatal bool
	configError error
}

func NewGpgCLI() *GpgCLI {
	return &GpgCLI{configured: false}
}

func (g *GpgCLI) Configure() (isFatal bool, err error) {
	if g.configured {
		isFatal = g.configFatal
		err = g.configError
	}

	return
}

func (g *GpgCLI) Export(k PgpKeyBundle) error {
	return nil
}
