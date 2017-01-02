InspIRCd Link Discovery
===

This is a little NodeJS project to allow inspircd to scale dynamically in docker swarm setups with overlay networks.

Your servers need to load [m_httpd_rehash](https://gist.github.com/SISheogorath/c3e2a6cd08ffd51897a7dcea422f1a43) and listen on port 80.

They also need to do a http call to `http://name-of-your-discovery-service:3000/conf/<hostname>`.

Further automatation comming soon. Including out-of-the-box working images.

## Howto setup testnet

### The fast way

Spin up a digital ocean droplet (tested) or a local VM and run the `bootstrap.sh`.

When the script has sucessful finished it's work you get a worker token to add more node to the docker swarm already running 3 instances of inspircd.

```console
wget -O- https://raw.githubusercontent.com/SISheogorath/insp-link-discovery/master/bootstrap.sh | sudo sh -
```

### The long way

First of all we have to create a docker swarm. How to do this? See the [docker tutorial](https://docs.docker.com/engine/swarm/swarm-tutorial/create-swarm/)


After creating a little swarm we start with the creation of the overlay network we use for communication between our InsIRCd nodes and the discovery.

We name it for example `inspircd`

```console
docker network create \
  --driver overlay \
  --opt encrypted \
  inspircd
```

Time to setup the discovery...

```console
docker service create \
   --name discovery \
   --network inspircd \
   --env INSP_SERVICENAME=inspircd \
   sheogorath/insp-link-discovery
```

Now download the inspircd container sources, patch it with all needed modifications and build the docker image.

After building the image we create the service and scale it up to 3 instances which are automatically linked together.

```console
git clone https://github.com/Adam-/inspircd-docker.git inspircd-docker
cd inspircd-docker
wget https://gist.github.com/SISheogorath/abf315c200fbdf3733b9fb31320b10eb/raw/d8a1879b91f874f9262a1f6462d43154c1b6b3bb/0001-Changes-for-usage-of-insp-conf-discovery.patch
echo >> 0001-Changes-for-usage-of-insp-conf-discovery.patch
git am 0001-Changes-for-usage-of-insp-conf-discovery.patch
docker build -t inspircd:latest .

docker service create \
  --name inspircd \
  --publish 6667:6667 \
  --publish 6697:6697 \
  --network inspircd \
  inspircd:latest

docker service scale inspircd=3
```

Wanna test? Connect to any of your docker swarm nodes using your IRC client. Use port 6667 for plaintext and 6697 for tls encrypted ports.

It's amazing, isn't it?
