var fs = require('fs');
var _ = require('underscore');

/**
 * Module dependencies.
 */

var express = require('express')
  , client = require('redis').createClient()
  , routes = require('./routes')

var app = module.exports = express.createServer();

/**
 * Module setup.
 */

app.use(express.bodyParser());

/**
 * Utility functions
 */

var read_config = function() {
  var data = fs.readFileSync('config.json');
  return JSON.parse(data);
};

var get_random_string = function(len) {
  var s = "abcdefghijkmnopqrstuvwxyz";
  var result = '';
  while (result.length < len) {
    result += s[Math.floor(Math.random() * s.length)]
  }
  return result;
};

var get_extension  = function(content) {
  if (Boolean(~content.indexOf("<html>"))) {
    return '.html';
  } else {
    var result = get_image_type(content);
    if (result) {
      return result;
    }
  }
  return '';
}

var get_image_type = function(content) {
  if (!content.indexOf("\xFF\xD8\xFF")) {
    return '.jpeg'
  } else if (!content.indexOf("GIF")){
    return '.gif'
  } else if (!content.indexOf("\x89\x50\x4e\x47\x0d\x0a")) {
    return '.png'
  } else if (!content.indexOf("BM")) {
    return '.bmp';
  } else if (!content.indexOf('8BPS')) {
    return '.psd';
  } else if (!content.indexOf('FWS')) {
    return '.swf';
  }
  return null;
};

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/pastie/user/:user', function(req, res){
  res.send("Not yet implemented.");
});

app.get('/', function(req, res) {
  var config = read_config();
  client.zrangebyscore("leaderboard", "-inf", "+inf", function(err, users) {
    client.lrange("public_pasties", 0, 20, function(err, public_pasties) {
      if (err) {
        return res.send(err);
      }
      var remaining = public_pasties.length;
      if (!public_pasties.length) {
        res.render("index.jade", {
          title: "Pastie",
          host: config.host + ":" + config.port,
          leaderboard: users,
          public_pasties: public_pasties,
        });
      } else {
        _.each(public_pasties, function(id, index) {
          client.hgetall("pastie:" + id, function(err, result) {
            public_pasties.push(result);
            remaining -= 1;
            if (!remaining) {
              res.render("index.jade", {
                title: "Pastie",
                host: config.host + ":" + config.port,
                leaderboard: users,
                public_pasties: public_pasties,
              });
            }
          });
        });
      }
    });
  });
});

app.get('/pastie/:id.html', function(req, res) {
  client.hgetall("pastie:" + req.params.id, function(err, result) {
    if (err) {
      return res.send(err);
    }
    res.send(result.content);
  });
});

app.get('/pastie/:id.:extension(jpeg|gif|png|bmp|psd|swf)', function(req, res) {
  client.hgetall("pastie:" + req.params.id, function(err, result) {
    if (err) {
      return res.send(err);
    }
    res.setHeader("Content-Type", "image/" + req.params.extension);
    res.write(result.content, 'binary');
    res.end();
  });
});

app.get('/pastie/:id', function(req, res) {
  client.hgetall("pastie:" + req.params.id, function(err, result) {
    if (err) {
      return res.send(err);
    }
    res.setHeader("Content-Type", "text/plain");
    res.send(result.content);
  });
});

app.get('/pastie/topic/:topic', function(req, res) {
  client.lrange("pastie_topic:" + req.params.topic, 0, -1, function(err, result) {
    if (err) {
      return res.send(err);
    }

    var batch_cmds = client.multi();
    _.each(result, function(pastie_id) {
        batch_cmds.hgetall("pastie:" + pastie_id);
    });
    // Execute the batch command and send the text content
    batch_cmds.exec(function(error, responses) {
        if (error) {
          return res.send(error);
        }
        var output = "";
        _.each(responses, function(r) {
            var str = r.author + ": " + r.content;
            output = output + str;
        });
        res.setHeader("content-type", "text/plain");
        res.send(output);
    });
  });
});

app.post('/pastie', function(req, res) {
  var fn = function() {
    var id = get_random_string(5);
    client.exists("pastie:" + id, function(err, exists) {
      if (exists) {
        return fn();
      } else {
        var pastie = req.body.pastie;
        pastie.content = new Buffer(pastie.content, 'base64').toString('binary');
        var is_html = Boolean(~pastie.content.indexOf("<html>"));
        var is_img = get_image_type(pastie.content);

        if (!pastie) {
          return res.send(JSON.stringify({"error": "invalid JSON passed"}));
        }

        pastie.id = id;
        pastie.created = (new Date()).getTime();
        pastie.extension = get_extension(pastie.content);

        client.hmset("pastie:" + id, pastie, function(err, result) {
          if (err) {
            return res.send(err);
          }
          client.lpush("user_pasties:" + pastie.author, id, function(err, result) {
            if (err) {
              return cb(err);
            }
            if (!pastie.private) {
              client.lpush("public_pasties", id);
            }
            if (pastie.expiry) {
              client.expire("pastie:" + id, pastie.expiry);
            }
            if (pastie.topic) {
              client.lpush("pastie_topic:" + pastie.topic, id);
            }
            client.zincrby("leaderboard", 1, pastie.author);
            res.send(JSON.stringify({pastie: {id: id, extension: pastie.extension}}));
          });
        });
      }
    });
  };

  fn();
});

app.listen(read_config().port);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
