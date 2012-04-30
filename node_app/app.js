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
  config = read_config()
  client.zrangebyscore("leaderboard", "-inf", "+inf", function(err, users) {
    client.lrange("public_pasties", 0, 20, function(err, public_pasties) {
      if (err) { 
        return res.send(err); 
      }
      var remaining = public_pasties.length;
      if (!public_pasties.length) {
        res.render("index.jade", {
          title: "Pastie",
          host: config.host,
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
                host: config.host,
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

app.get('/pastie/:id', function(req, res) {
  client.hgetall("pastie:" + req.params.id, function(err, result) {
    if (err) { 
      return res.send(err); 
    }
    res.setHeader("content-type", "text/plain");
    res.send(result.content);
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

        if (!pastie) {
          return res.send(JSON.stringify({"error": "invalid JSON passed"}));
        }

        pastie.id = id;
        pastie.created = (new Date()).getTime();

        client.hmset("pastie:" + id, pastie, function(err, result) {
          if (err) { 
            return res.send(err); 
          }
          client.lpush("user_pasties:" + pastie.user, id, function(err, result) {
            if (err) {
              return cb(err);
            }
            if (!pastie.private) {
              client.lpush("public_pasties", id);
            }
            if (pastie.expiry) {
              client.expire("pastie:" + id, pastie.expiry);
            }
            client.zincrby("leaderboard", 1, pastie.author);
            res.send(JSON.stringify({pastie: {id: id}}));
          });
        });
      }
    });
  };

  fn();
});

app.listen(4000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
