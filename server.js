var dns        = require('dns')
var express    = require('express');
var generatePassword = require('password-generator');
var request    = require('request');
var app        = express();
var data       = {};

var suffix     = process.env.INSP_SUFFIX || ".example.com"

// Generate configs
app.get('/conf/:id', function (req, res) {
    var id = req.params.id;
    // Make sure there is a dataset for this node.
    if (!data[id]) {
        data[id] = {};
        data[id].id = id;
        // Maybe our discovery is hidden behind a reverse proxy
        data[id].ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        data[id].password = generatePassword(64, false);
        // Notify all nodes to rehash confgs to make the node known in the existing cluster.
        for(var key in data) {
                rehash(data[key]);
        }
    // maybe the nodes ip changed. Make sure we update it.
    } else if ((data[id].ip !== req.headers['x-forwarded-for']) && (data[id].ip !== req.connection.remoteAddress)) {
        data[id].ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        for(var key in data) {
                rehash(data[key]);
        }
    }
    var confresponse = "";
    var remotes = [];
    for(var key in data) {
        remote = data[key];
//    data.forEach(function (remote) {
        if (remote.id != id) {
             confresponse += '<link name="' + remote.id + suffix + '" ' +
                 'ipaddr="'+ remote.id +'" ' +
                 'port="7001" ' +
                 'allowmask="' + remote.ip + '/24" ' +
                 'timeout="300" ' +
                 'ssl="gnutls" ' +
                 'statshidden="no" ' +
                 'hidden="no" ' +
                 'sendpass="' + remote.password + '" ' +
                 'recvpass="' + data[id].password + '">\n';
             remotes.push(remote.id + suffix);
        }
    }
    //})
    console.log(remotes.length)
    if (remotes.length > 0)
        confresponse += '<autoconnect period="10" server="' +  remotes.join(" ")  + '">';

    res.send(confresponse);
});



app.listen(3000, function () {
      console.log('Example app listening on port 3000!')
});

function rehash(remote) {
    request.get("http://" + remote.id + ":8080/rehash", function () {
        console.log("Rehashing " + remote.id + suffix + "...");
    });
}

