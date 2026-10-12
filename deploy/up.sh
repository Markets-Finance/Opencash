#!/usr/bin/env bash
set -euo pipefail
region=ap-southeast-2
name=opencash-monad-api
key="${SSH_KEY:-$HOME/.ssh/opencash_aws}"
ssh_opts="-i $key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
root="$(cd "$(dirname "$0")/.." && pwd)"

if ! aws lightsail get-instance --region $region --instance-name $name >/dev/null 2>&1; then
  aws lightsail create-instances --region $region --instance-names $name --availability-zone ${region}a \
    --blueprint-id ubuntu_24_04 --bundle-id micro_3_2 --key-pair-name opencash-deploy >/dev/null
fi
until [ "$(aws lightsail get-instance --region $region --instance-name $name --query instance.state.name --output text)" = running ]; do sleep 5; done
aws lightsail get-static-ip --region $region --static-ip-name $name-ip >/dev/null 2>&1 || \
  aws lightsail allocate-static-ip --region $region --static-ip-name $name-ip >/dev/null
aws lightsail attach-static-ip --region $region --static-ip-name $name-ip --instance-name $name >/dev/null 2>&1 || true
aws lightsail put-instance-public-ports --region $region --instance-name $name \
  --port-infos fromPort=22,toPort=22,protocol=tcp >/dev/null
ip=$(aws lightsail get-static-ip --region $region --static-ip-name $name-ip --query staticIp.ipAddress --output text)
server=ubuntu@$ip
echo "server $server"
until ssh $ssh_opts -o ConnectTimeout=5 $server true 2>/dev/null; do sleep 5; done

cloudflared tunnel list -o json --name $name | jq -e 'length > 0' >/dev/null || cloudflared tunnel create $name >/dev/null
tunnel=$(cloudflared tunnel list -o json --name $name | jq -r '.[0].id')
cloudflared tunnel route dns $tunnel monad-api.opencash.in || true

SERVER=$server SSH_KEY=$key "$root/deploy/push.sh"
ssh $ssh_opts $server "sudo TUNNEL_ID=$tunnel bash /opt/opencash-monad/deploy/setup.sh"
scp $ssh_opts "$HOME/.cloudflared/$tunnel.json" $server:/tmp/tunnel.json
ssh $ssh_opts $server "sudo install -m 600 /tmp/tunnel.json /etc/cloudflared/$tunnel.json && rm /tmp/tunnel.json && (systemctl list-unit-files cloudflared.service | grep -q cloudflared || sudo cloudflared --config /etc/cloudflared/config.yml service install)"

echo
echo "Next: ssh $ssh_opts $server"
echo "  sudo nano /etc/opencash-monad.env   # fill the API keys"
echo "  sudo systemctl enable --now opencash-monad && sudo systemctl restart cloudflared"
echo "Then: curl https://monad-api.opencash.in/health"
