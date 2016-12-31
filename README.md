InspIRCd Link Discovery
===

This is a little NodeJS project to allow inspircd to scale dynamically in docker swarm setups with overlay networks.

Your servers need to load [m_httpd_rehash](https://gist.github.com/SISheogorath/c3e2a6cd08ffd51897a7dcea422f1a43) and listen on port 80.

They also need to do a http call to `http://name-of-your-discovery-service/conf/<hostname>`.

Further automatation comming soon. Including out-of-the-box working images.

This is my last 2016 projekt :) Happy 2017
