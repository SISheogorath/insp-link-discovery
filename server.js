var dns        = require('dns')
var express    = require('express');
var generatePassword = require('password-generator');
var request    = require('request');
var app        = express();
var data       = {};

var suffix     = process.env.INSP_SUFFIX || ".example.com"

app.get('/conf/:id', function (req, res) {
    var id = req.params.id;
    if (!data[id]) {
        data[id] = {};
        data[id].id = id;
        data[id].ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        data[id].password = generatePassword(64, false);
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
                 'port="7000" ' +
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

app.listen(80, function () {
      console.log('Example app listening on port 3000!')
});

function rehash(remote) {
    request.get("http://" + remote.id + "/rehash", function () {
        console.log("Rehashing " + remote.id + suffix + "...");
    });
}

