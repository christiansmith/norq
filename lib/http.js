/*
 * Norq HTTP Interface
 * Copyright(c) 2011 Christian Smith <smith@anvil.io>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var express = require('express');
var norq = require('./norq');

/**
 * Initialize a new `NorqClient`
 * This should be done from a config file,
 * but until I get to it we'll just plug in 
 * some examples for testing.
 */

var client = norq.createClient({ 
  pusher: { name: 'pusher' },
  peeker: { name: 'peeker' },
  popper: { name: 'popper' },
  longer: { name: 'longer' },
  getter: { name: 'getter' },
  setter: { name: 'setter' }
});

/**
 * Initialize a new HTTPServer instance.
 */

var app = module.exports = express.createServer();


/**
 * Configure the server.
 */

app.use(express.bodyParser());

/**
 * Exceptions
 */

function RequestNotJSONError(request) {
  this.name = 'RequestNotJSONError';
  this.message = 'Request Content-Type must be application/json.'
  Error.call(this, 'Content-Type is not application/json');
  Error.captureStackTrace(this, arguments.callee);
}

RequestNotJSONError.prototype.__proto__ = Error.prototype;

/**
 * Error Handlers
 */

// if Content-Type needs to be JSON but is something else...
app.error(function (err, request, response, next) {
  if (err instanceof RequestNotJSONError) {
    response.send({ status: 400, message: err.message }, 400);
  } else {
    next(err);
  }
});

// if queue in route isn't defined in the model
app.error(function (err, request, response, next) {
  if (err instanceof norq.QueueNotFoundError) {
    response.send(err, 404);
  } else {
    next(err);
  } 
});

// if data passed to push or set is not an object...
app.error(function (err, request, response, next) {
  if (err instanceof norq.DataNotObjectError) {
    response.send(err, 400);
  } else {
    next(err);
  } 
});

/**
 * HTTP API FOR NORQ
 */

app.get('/', function (req, res) {
  res.send({ message: 'hello!'});  
});

/**
 * client.push
 * $ curl -XPOST http://hostname:port/work -d '{...}' -H 'Content-Type: application/json'
 */

app.post('/:queue', function (request, response) {
  if (!request.is('json')) throw new RequestNotJSONError(request);
  client.push(request.params.queue, request.body, function (err, result) {
    if (err) throw err; 
    response.send(result, 201);
  }); 
});

/**
 * client.peek
 * $ curl -XGET http://hostname:port/work/next
 */

app.get('/:queue/next', function (request, response) {
  client.peek(request.params.queue, function (err, result) {
    if (err) throw err;
    response.send(JSON.parse(result), 200);
  }); 
});

/**
 * client.pop
 * $ curl -XDELETE http://hostname:port/work/next
 */

app.del('/:queue/next', function (request, response) {
  client.pop(request.params.queue, function (err, result) {
    if (err) throw err;
    response.send(JSON.parse(result), 200);
  }); 
});

/**
 * client.range
 * $ curl -XGET http://hostname:port/work/0..9
 *
 * This route has three parameters, corresponding to 
 * the first three arguments of client.range.
 *
 * Wish we could destructure params, e.g.,
 * [queue, start, end] = request.params;
 */

app.get(/^\/([\w-]+)\/(\d+)\.\.(\d+)/, function (request, response) {
  var params = request.params;
  client.range(params[0], params[1], params[2], function (err, results) {
    if (err) throw err;
    response.send(results.map(function (item) {
      return JSON.parse(item);
    }), 200);
  });
});

/**
 * client.head
 * $ curl -XGET http://hostname:port/work/+5
 */

app.get(/^\/([\w-]+)\/\+(\d+)/, function (request, response) {
  var params = request.params;
  client.head(params[0], params[1], function (err, results) {
    if (err) throw err;
    response.send(results.map(function (item) {
      return JSON.parse(item);
    }), 200);
  });    
});

/**
 * client.tail
 * $ curl -XGET http://hostname:port/work/-5
 */

app.get(/^\/([\w-]+)\/\-(\d+)/, function (request, response) {
  var params = request.params;
  client.tail(params[0], params[1], function (err, results) {
    if (err) throw err;
    response.send(results.map(function (item) {
      return JSON.parse(item);
    }), 200);
  }); 
});

/**
 * client.get
 * $ curl -XGET http://hostname:port/work/id
 */

app.get('/:queue/:id', function (request, response) {
  var params = request.params;
  client.get(params.queue, params.id, function (err, result) {
    if (err) throw err;
    response.send(JSON.parse(result), 200); 
  }); 
});

/**
 * client.set
 * $ curl -XPUT http://hostname:port/work/id -d '{ _id: id, ... }' -H 'Content-Type: application/json'
 */

app.put('/:queue/:id', function (request, response) {
  var params = request.params;
  if (!request.is('json')) throw new RequestNotJSONError(request);
  client.set(params.queue, params.id, request.body, function (err, result) {
    if (err) throw err;
    response.send(result, 200);
  });
});

// Only listen on $ node app.js
if (!module.parent) {
  app.listen(3000);
  console.log('Norq HTTP Interface listening on port %d', app.address().port);
}
