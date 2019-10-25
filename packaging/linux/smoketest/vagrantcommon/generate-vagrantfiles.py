#!/usr/bin/env python3
from collections import namedtuple
import os

template = """Vagrant.configure("2") do |config|
  config.vm.box = "{}"
  {}
  config.vm.synced_folder "../vagrantcommon/", "/vagrant", type: "rsync"
  config.vm.provider "virtualbox" do |vb|
    vb.memory = "4096"
  end
  config.vm.provision "shell", path: "../vagrantcommon/provision_{}.bash"
  config.ssh.forward_x11 = true
  config.vm.network :forwarded_port, guest: 22, host: {}, id: "ssh"
  config.vbguest.auto_update = false
end
"""

Platform = namedtuple('Platform', ['name', 'box', 'type', 'port', 'extras'])

platforms = [
    # Platform('ubuntu-latest', 'ubuntu/eoan64', 'deb', 2401,
    #          ["config.vm.box_version = \"20191016.0.0\""]),
    Platform('ubuntu-stable', 'ubuntu/bionic64', 'deb', 2402, []),
    Platform('debian-stable', 'debian/buster64', 'deb', 2403, []),
    Platform('fedora', 'generic/fedora30', 'rpm', 2404, []),
    Platform('centos', 'centos/7', 'rpm', 2405, []),
]

for platform in platforms:
    os.makedirs(platform.name, exist_ok=True)
    vagrantfile = template.format(platform.box, '\n'.join(platform.extras),
                                  platform.type, platform.port)
    with open(os.path.join(platform.name, 'Vagrantfile'), 'w') as h:
        h.write(vagrantfile)
    with open(os.path.join(platform.name, 'port'), 'w') as h:
        h.write(str(platform.port))
