set -e -u -o pipefail # Fail on error

: ${RN_DIR:?"Need to set RN_DIR"}

cd $RN_DIR

npm start &
npm_cmd_pid=$!

while [[ -z "$(pgrep -P $npm_cmd_pid)" ]]
do
  echo "Waiting for packager to start"
  sleep 1
done

rn_packager_pid="$(pgrep -P $npm_cmd_pid)"

cleanup() {
  pkill -P $rn_packager_pid
}

trap 'cleanup' ERR

wait $npm_cmd_pid
cleanup
