let configs: any = require('remote').getGlobal('configuration');

export = {
  setConfigs(loadedConfigs: any) {
    configs = loadedConfigs;
  },
  getConfig(configName: string): any {
    return configs[configName];
  },
  get(configName: string, fieldName: string): any {
    let config = this.getConfig(configName);
    if (config) {
      return config[fieldName];
    } else {
      return undefined;
    }
  }
};
