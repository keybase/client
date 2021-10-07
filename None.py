# -*- coding: utf-8 -*-
from typing import Optional, List
import nixops.util

from nixops.backends import MachineDefinition, MachineState, MachineOptions
from nixops.util import attr_property, create_key_pair
from nixops.state import RecordId
import nixops.resources

import nixops


class NoneDefinition(MachineDefinition):
    """Definition of a trivial machine."""

    _target_host: str
    _public_ipv4: Optional[str]

    config: MachineOptions

    @classmethod
    def get_type(cls) -> str:
        return "none"

    def __init__(self, name: str, config: nixops.resources.ResourceEval):
        super().__init__(name, config)
        self._target_host = config["targetHost"]
        self._public_ipv4 = config.get("publicIPv4", None)


class NoneState(MachineState[NoneDefinition]):
    """State of a trivial machine."""

    @classmethod
    def get_type(cls) -> str:
        return "none"

    target_host: str = nixops.util.attr_property("targetHost", None)
    public_ipv4: Optional[str] = nixops.util.attr_property("publicIpv4", None)
    _ssh_private_key: Optional[str] = attr_property("none.sshPrivateKey", None)
    _ssh_public_key: Optional[str] = attr_property("none.sshPublicKey", None)
    _ssh_public_key_deployed: bool = attr_property(
        "none.sshPublicKeyDeployed", False, bool
    )

    def __init__(self, depl: "nixops.deployment.Deployment", name: str, id: RecordId):
        MachineState.__init__(self, depl, name, id)

    @property
    def resource_id(self):
        return self.vm_id

    def get_physical_spec(self):
        return (
            {
                (
                    "config",
                    "users",
                    "extraUsers",
                    "root",
                    "openssh",
                    "authorizedKeys",
                    "keys",
                ): [self._ssh_public_key]
            }
            if self._ssh_public_key
            else {}
        )

    def create(
        self,
        defn: NoneDefinition,
        check: bool,
        allow_reboot: bool,
        allow_recreate: bool,
    ) -> None:
        assert isinstance(defn, NoneDefinition)
        self.set_common_state(defn)
        self.target_host = defn._target_host
        self.public_ipv4 = defn._public_ipv4

        if not self.vm_id:
            if self.provision_ssh_key:
                self.logger.log_start("generating new SSH key pair... ")
                key_name = "NixOps client key for {0}".format(self.name)
                self._ssh_private_key, self._ssh_public_key = create_key_pair(
                    key_name=key_name
                )

            self.logger.log_end("done")
            self.vm_id = "nixops-{0}-{1}".format(self.depl.uuid, self.name)

    def switch_to_configuration(
        self, method: str, sync: bool, command: Optional[str] = None
    ) -> int:
        res = super(NoneState, self).switch_to_configuration(method, sync, command)
        if res == 0:
            self._ssh_public_key_deployed = True
        return res

    def get_ssh_name(self) -> str:
        assert self.target_host
        return self.target_host

    def get_ssh_private_key_file(self) -> Optional[str]:
        if self._ssh_private_key_file:
            return self._ssh_private_key_file
        elif self._ssh_private_key:
            return self.write_ssh_private_key(self._ssh_private_key)
        return None

    def get_ssh_flags(self, *args, **kwargs) -> List[str]:
        super_state_flags = super(NoneState, self).get_ssh_flags(*args, **kwargs)
        if self.vm_id and self.cur_toplevel and self._ssh_public_key_deployed:
            key_file = self.get_ssh_private_key_file()
            flags = super_state_flags + [
                "-o",
                "StrictHostKeyChecking=accept-new",
            ]
            if key_file:
                flags = flags + ["-i", key_file]
            return flags

        return super_state_flags

    def _check(self, res):
        if not self.vm_id:
            res.exists = False
            return
        res.exists = True
        res.is_up = self.ping()
        if res.is_up:
            super()._check(res)

    def destroy(self, wipe: bool = False) -> bool:
        # No-op; just forget about the machine.
        return True


import to Mu
