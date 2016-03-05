// Native imports

var fs = require('fs');


// Third-party imports

var _ = require('underscore');
var express = require('express');
var client = require('redis').createClient();


// Application setup

var app = module.exports = express.createServer();
app.use(express.bodyParser());


// Utility functions

var read_config = function() {
	try {
		var data = fs.readFileSync('/etc/pastie/config.json');
		return JSON.parse(data);
	} catch (err) {
		return {};
	}
};

var get_random_string = function(len) {
  var s = 'abcdefghijkmnopqrstuvwxyz';
  var result = '';
  while (result.length < len) {
    result += s[Math.floor(Math.random() * s.length)];
  }
  return result;
};

var get_extension  = function(content) {
  if (Boolean(~content.indexOf('<html>'))) {
    return '.html';
  } else {
    var result = get_image_type(content);
    if (result) {
      return result;
    }
  }
  return '';
};

var get_image_type = function(content) {
  if (!content.indexOf('\xFF\xD8\xFF')) {
    return '.jpeg';
  } else if (!content.indexOf('GIF')){
    return '.gif';
  } else if (!content.indexOf('\x89\x50\x4e\x47\x0d\x0a')) {
    return '.png';
  } else if (!content.indexOf('BM')) {
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

app.get('/status', function(req, res) {
  res.setHeader('Content-Type', 'text/plain');
  return res.send('ready: 1\n');
});

app.get('/', function(req, res) {
  var config = read_config();
  var public_pasties = [];
  client.lrange('public_pastie_ids', 0, 100, function(err, public_pastie_ids) {
    if (err) {
      // No public pasties yet.  Continue as normal.
    }
    if (public_pastie_ids.length) {
      _.each(public_pastie_ids, function(id, index) {
        client.hgetall('pastie:' + id, function(err, result) {
          public_pasties.push(result);
        });
      });
    }
    client.hgetall('pastie_users', function(err, pastie_users) {
      pastie_users_sorted = Object.keys(pastie_users || {}).sort();
      res.render('index.jade', {
        title: 'Pastie',
        host: config.host + ':' + config.port,
        public_pasties: public_pasties,
        pastie_users: pastie_users,
        pastie_users_sorted: pastie_users_sorted,
      });
    });
  });
});

app.get('/pastie/:id/:title?', function(req, res) {
  client.hgetall('pastie:' + req.params.id, function(err, result) {
    if (err) {
      return res.send(err);
    }
    else if (result === null || Object.keys(result).length === 0) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send('No pastie exists with the provided ID. Perhaps the pastie expired?');
    } else {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(result.content);
    }
  });
});

app.delete('/pastie/:id', function(req, res) {
  client.del(['pastie:' + req.params.id], function(err, result) {
    res.setHeader('Content-Type', 'application/json');
    if (result === 0) {
      return res.send(JSON.stringify({'message': 'Error: No Pastie found with ID'}));
    } else {
      return res.send(JSON.stringify({'message': 'Pastie deleted successfully'}));
    }
  });
});

app.get('/pastie/:id.html/:title?', function(req, res) {
  client.hgetall('pastie:' + req.params.id, function(err, result) {
    if (err) {
      return res.send(err);
    }
    return res.send(result.content);
  });
});

app.get('/pastie/:id.:extension(jpeg|gif|png|bmp|psd|swf)', function(req, res) {
  client.hgetall('pastie:' + req.params.id, function(err, result) {
    if (err) {
      return res.send(err);
    }
    res.setHeader('Content-Type', 'image/' + req.params.extension);
    res.write(result.content, 'binary');
    res.end();
  });
});

app.post('/pastie', function(req, res) {
  var fn = function() {
    var id = get_random_string(5);
    client.exists('pastie:' + id, function(err, exists) {
      if (exists) {
        return fn();
      } else {
        var pastie = req.body.pastie;
        pastie.content = new Buffer(pastie.content, 'base64').toString('binary');
        var is_html = Boolean(~pastie.content.indexOf('<html>'));
        var is_img = get_image_type(pastie.content);

        if (!pastie) {
          return res.send(JSON.stringify({'error': 'invalid JSON passed'}));
        }

        pastie.id = id;
        pastie.created = (new Date()).getTime();
        pastie.extension = get_extension(pastie.content);

        client.hincrby('pastie_users', pastie.author, 1, function(err, result) {
          if (err) {
            return res.send(err);
          }
          client.hmset('pastie:' + id, pastie, function(err, result) {
            if (err) {
              return res.send(err);
            }
            client.lpush('user_pasties:' + pastie.author, id, function(err, result) {
              if (err) {
                return cb(err);
              }
              if (pastie.public) {
                client.lpush('public_pastie_ids', id);
              }
              if (pastie.expiry) {
                client.expire('pastie:' + id, pastie.expiry);
              }
              var res_body = {pastie: {id: id, extension: pastie.extension}};
              if (pastie.title) {
                res_body.title = pastie.title;
              }
              return res.send(JSON.stringify(res_body));
            });
          });
        });
      }
    });
  };

  fn();
});


// Main
(function() {
  var port;
  if (typeof read_config().port === 'undefined') {
    port = 80;
  } else {
    port = read_config().port;
  }
  app.listen(port);
  console.log('Express server listening on port %d in %s mode', app.address().port, app.settings.env);
}());
