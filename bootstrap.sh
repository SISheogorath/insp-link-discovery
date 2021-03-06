#!/bin/sh

# Check that all needed tools are oresend
command -v git >/dev/null 2>&1 || { echo >&2 "I require git but it's not installed.  Aborting."; exit 1; }
command -v grep >/dev/null 2>&1 || { echo >&2 "I require grep but it's not installed.  Aborting."; exit 1; }
command -v head >/dev/null 2>&1 || { echo >&2 "I require head but it's not installed.  Aborting."; exit 1; }
command -v ip >/dev/null 2>&1 || { echo >&2 "I require ip but it's not installed.  Aborting."; exit 1; }
command -v wget >/dev/null 2>&1 || { echo >&2 "I require wget but it's not installed.  Aborting."; exit 1; }

# Check if docker is already installed. If not try to install it
command -v docker >/dev/null 2>&1 || { 
  wget -O- http://get.docker.com | sh - 
}
command -v docker >/dev/null 2>&1 || { echo >&2 "I require docker but it's not installed and I can't install it myself.  Aborting."; exit 1; }


# Doing some crazy magic to find the right ip which can used to advertise docker swarm.
docker swarm init --advertise-addr `ip addr s | grep global | grep -oE '((1?[0-9][0-9]?|2[0-4][0-9]|25[0-5])\.){3}(1?[0-9][0-9]?|2[0-4][0-9]|25[0-5])' | head -n1`

# Creating encrypted overlay network for server linking and discovery
docker network create \
  --driver overlay \
  --opt encrypted \
  inspircd
echo Created network

# setup discovery service
docker service create \
  --name discovery \
  --network inspircd \
  --env INSP_SERVICENAME=inspircd \
  sheogorath/insp-link-discovery
echo Created discovery service

# Clone modify and build inspircd docker image to work with discovery
git clone https://github.com/Adam-/inspircd-docker.git inspircd-docker
cd inspircd-docker
wget https://raw.githubusercontent.com/SISheogorath/insp-link-discovery/master/0001-Changes-for-usage-of-insp-conf-discovery.patch
echo >> 0001-Changes-for-usage-of-insp-conf-discovery.patch
git am 0001-Changes-for-usage-of-insp-conf-discovery.patch
sed -i 's/perl-lwp-protocol-https wget gnutls-dev/perl-lwp-protocol-https gnutls-dev/' Dockerfile
wget -O modules/m_httpd_rehash.cpp https://gist.githubusercontent.com/SISheogorath/c3e2a6cd08ffd51897a7dcea422f1a43/raw/594d58c3c0431e5a74cacbdff6710b2cb7987e6a/m_httpd_rehash.cpp
docker build -t inspircd:latest .

# Setup inspircd service
docker service create \
  --name inspircd \
  --publish 6667:6667 \
  --publish 6697:6697 \
  --network inspircd \
  inspircd:latest
echo Created inspircd service

# Scale inspircd service up to 3 running instances
docker service scale inspircd=3

# Show swarm join token to allow user to add more swarm member and scale
docker swarm join-token worker
