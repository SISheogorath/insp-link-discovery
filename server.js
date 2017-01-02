var dns        = require('dns');
var ip         = require('ip');
var timer      = require('timers');
var express    = require('express');
var generatePassword = require('password-generator');
var request    = require('request');
var app        = express();
var data       = {};
// Counter deletions since last global rehash
var deletecounter = 0;

var suffix     = process.env.INSP_SUFFIX || ".example.com"
var leafsize   = process.env.INSP_CLUSTERSIZE || 3;


// Generate configs
app.get('/conf/:id/:fingerprint?', function (req, res) {
    var id = req.params.id;
    var fingerprint = req.params.fingerprint || null;
    // Make sure there is a dataset for this node.
    if (!data[id]) {
        data[id] = {};
        data[id].id = id;
        // Maybe our discovery is hidden behind a reverse proxy
        data[id].ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        data[id].password = generatePassword(64, false);
        if (fingerprint)
            data[id].fingerprint = fingerprint;
        // Notify all nodes to rehash confgs to make the node known in the existing cluster.
        rehashAll();
    // maybe the nodes ip changed. Make sure we update it.
    } else if ((data[id].ip !== req.headers['x-forwarded-for']) && (data[id].ip !== req.connection.remoteAddress)) {
        data[id].ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        rehashAll();
    } else if (data[id].fingerprint && fingerprint && data[id].fingerprint !== fingerprint) {
        data[id].fingerprint = fingerprint;
        rehashAll();
    }
    var confresponse = "";
    // Generating config
    for(var key in data) {
        remote = data[key];
        // create a link tag for every server excluding ourself
        if (remote.id != id) {
             confresponse += '<link name="' + remote.id + suffix + '" ' +
                 'ipaddr="'+ remote.id +'" ' +
                 'port="7001" ' +
                 'allowmask="' + remote.ip + (ip.isV6Format(remote.ip) ? '/128" ' : '/32" ') +
                 'timeout="300" ' +
                 'ssl="gnutls" ' +
                 'statshidden="no" ' +
                 (remote.fingerprint ? ('fingerprint="' + remote.fingerprint + '" ') : '') +
                 'hidden="no" ' +
                 'sendpass="' + remote.password + '" ' +
                 'recvpass="' + data[id].password + '">\n';
        }
    }

    // To let servers automatically join the cluster
    confresponse += buildAutoconnect(data[id].id);

    res.send(confresponse);
});

// Garbage collection
timer.setInterval(function() {
    console.log("Running garbage collection");
    for(var key in data) {
        var collectGarbage = function (key) {
            // if the node is not resolveable it's dead. We have to remove it from the cluster
            dns.lookup(data[key].id, function(err) {
                if (err) {
                    deletecounter++;
                    delete(data[key]);
                    console.log("Delete " + key + suffix);
                    // If we delete as many nodes as the size of one leaf we may loose an whole uplink. In order to prevent that we rehash all nodes and buod a new cluster structure.
                    if (deletecounter > leafsize - 1)
                        rehashAll();
                }
            });
        };
        collectGarbage(key);
    }
}, 15 * 1000);

app.listen(3000, function () {
      console.log('Example app listening on port 3000!')
});

function rehash(remote) {
    request.get("http://" + remote.id + ":8080/rehash", function () {
        console.log("Rehashing " + remote.id + suffix + "...");
    });
}

function rehashAll() {
    deletecounter = 0;
    for(var key in data) {
        rehash(data[key]);
    }
}

function buildAutoconnect(node) {
    var returnvalue = "";
    var hubs        = [];

    // Get a array of all nodes
    var dataset     = Object.keys(data);
    // Find the current node
    var nodeindex   = dataset.indexOf(node);
    // Determine the beginning of the leaf
    var leafindex   = nodeindex - (nodeindex % leafsize);
    // Determine the beginning of next uplink leaf
    var uplinkindex = leafindex / leafsize - ((leafindex / leafsize) % leafsize);

    // If uplinks exists create a single entry for all nodes of the next uplink
    // This way we only try to connect one at the same time.
    if (uplinkindex !== 0) {
        for(var i = uplinkindex; i < (uplinkindex + leafsize) && i < dataset.length; i++)
            hubs.push(dataset[i] + suffix);
        if (hubs.length > 0)
            // Randomize order to minimize the chance of multiple servers starting handshake with the same uplink node
            returnvalue += '<autoconnect period="' + ((Math.random() * (2 * leafsize) + 10 | 0)) + '" server="' + hubs.sort(function(a, b){return 0.5 - Math.random()}).join(" ")  + '">';
    }

    // Create one autoconnect tag for every node on our leaf to make sure noone gets lost.
    for (var i = leafindex; i < (leafindex + leafsize) && i < dataset.length; i++)
        if (i !== nodeindex)
            returnvalue += '<autoconnect period="' + ((Math.random() * (5 * leafsize) + 30) | 0) + '" server="' + dataset[i] + suffix  + '">';

    return returnvalue;
}
