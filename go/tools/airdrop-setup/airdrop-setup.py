#!/usr/bin/python3
"""
Test script to be used for creating local accounts to test the airdrop. Note that this will only run against the local
keybase dev server since it uses the `keybase signup --batch` flag and relies on a dev only invite code.

Run via `python3 airdrop-setup.py out.json 1 2 3` in order to create:
- 1 account that has not accepted the disclaimer
- 2 accounts that have accepted the stellar disclaimer
- 3 accounts that have a starting balance
Data will be written to out.json in the form:

```
{
    'no_disclaimer': ['user1'],
    'accepted_disclaimer': ['user2', 'user3'],
    'with_balance': ['user4', 'user5'],
}
```
"""

import json
import os
from random import SystemRandom
from multiprocessing import Pool
import signal
import string
import subprocess
import sys
import time

import requests

# The maximum number of times we will retry if something goes wrong
RETRY_COUNT = 5

def compile():
    # Compile dev keybase
    print("Compiling keybase...")
    os.system("go install -tags devel github.com/keybase/client/go/keybase")

def secure_random(n):
    return ''.join([SystemRandom().choice(string.ascii_lowercase) for _ in range(n)])

def start_service(home):
    proc = subprocess.Popen(f"$GOPATH/bin/keybase --home {home} service", stdout=subprocess.PIPE,
                              shell=True, preexec_fn=os.setsid)
    while True:
        if os.path.exists(home + "/.config/keybase.devel/keybased.sock"):
            break
        time.sleep(0.1)
    return proc

def kill_service(home, proc):
    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    os.system(f"rm -r {home} 2>&1 > /dev/null")

def create_user(acceptDisclaimer=False, initBalance=False, retryCnt=0, *_):
    username = secure_random(16)
    password = secure_random(64)
    home = f"/tmp/airdrop-setup-{secure_random(32)}"
    proc = start_service(home)

    try:
        # This is a special dev only invite code that can be used repeatedly
        os.system(f"$GOPATH/bin/keybase --home {home} signup -batch --username {username} --passphrase {password} --no-email --invite-code 202020202020202020202020")
        if acceptDisclaimer or initBalance:
            output = subprocess.check_output(""" echo '{"method": "setup-wallet"}' | $GOPATH/bin/keybase --home %s wallet api """ % home, shell=True)
            assert b"disclaimer" in output, output

        if initBalance:
            api_ret = json.loads(subprocess.check_output(""" echo '{"method": "lookup", "params": {"options": {"name": "%s"}}}' | $GOPATH/bin/keybase --home %s wallet api """ % (username, home), shell=True))
            address = api_ret['result']['accountID']
            assert b"transaction" in requests.get(f"https://friendbot.stellar.org/?addr={address}").content
    except Exception as e:
        # If something goes wrong, just recur up to RETRY_COUNT times
        if retryCnt > RETRY_COUNT:
            raise e
        return create_user(acceptDisclaimer=acceptDisclaimer, initBalance=initBalance, retryCnt=retryCnt+1)
    finally:
        kill_service(home, proc)

    return username

def create_user_with_disclaimer(*_):
    return create_user(acceptDisclaimer=True)

def create_user_with_balance(*_):
    return create_user(initBalance=True)

if __name__ == '__main__':
    if len(sys.argv) != 5:
        print("Usage: `python3 airdrop-setup.py out.json X Y Z` where X is the number of users who have not accepted the disclaimer, Y is the number that have accepted the disclaimer, Z is the number that have a balance")
        exit(2)
    compile()
    # The number of processes to use in parallel. This can be adjusted based off of your system.
    p = Pool(16)
    print("Creating users without the disclaimer...")
    no_disclaimer = p.map(create_user, range(int(sys.argv[2])))
    print("Creating users with the disclaimer...")
    accepted_disclaimer = p.map(create_user_with_disclaimer, range(int(sys.argv[3])))
    print("Creating users with a testnet balance...")
    with_balance = p.map(create_user_with_balance, range(int(sys.argv[4])))
    print("Done! Writing to %s" % sys.argv[1])
    with open(sys.argv[1], 'w+') as f:
        f.write(json.dumps({
            'no_disclaimer': no_disclaimer,
            'accepted_disclaimer': accepted_disclaimer,
            'with_balance': with_balance,
        }))
