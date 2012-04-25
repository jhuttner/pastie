var fs = require('fs');

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
  return JSON.loads(data);
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

app.get('/', routes.index);

app.get('/pastie/user/:user', function(req, res){
  client.
  res.send(JSON.stringify({pasties: result});
  //res.send(JSON.stringify({
    //pasties: [
      //{
        //id: "goot",
        //description: "this is a brief description",
        //content: "This is is the hypothetical body",
      //},
      //{
        //id: "xhlx",
        //description: "a bit different description",
        //content: "A different body",
      //},
    //]
  //}));
});

app.get('/pastie/id/:id', function(req, res) {
  client.hget
  res.send(JSON.stringify({pastie: result});
});

app.post('/pastie', function(req, res) {
  var id;

  while (1) {
    id = get_random_string(4)
    if client.exists("pastie:" + id, function(err, result) {
      if (!result) { break; }
    });
  }

  client.hmset("pastie:" + id, req.body, function(err, result) {
    if (err) { return cb(err); }
    client.lpush("user_pasties:" + req.body.user, id, function(err, result) {
      //if (err) { return cb(err); }
      if (!req.body.private) {
        client.lpush("public_pasties:", id);
      }
      req.body.id = id;
      res.send(JSON.dumps(req.body));
    });
  });
});

// TODO: pretty UI items

app.listen(4000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
