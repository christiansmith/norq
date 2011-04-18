/*
 * Norq HTTP Interface
 * Copyright(c) 2011 Christian Smith <smith@anvil.io>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var express = require('express')
  , util = require('util')
  , fs = require('fs')
  , norq = require('./norq');

/**
 * Load model from a .json file
 */

var model = JSON.parse(fs.readFileSync('./config/model.json'));

/**
 * Initialize a new `NorqClient`
 */

var client = norq.createClient(model);

/**
 * Initialize a new HTTPServer instance.
 */

var app = module.exports = express.createServer();

/**
 * Make NorqClient instance available to parent module.
 * This allows the model to be overridden for testing.
 */

app.norq_client = client;

/**
 * Configure the server.
 */

app.use(express.bodyParser());

/**
 * Exceptions
 */

function ContentTypeNotJSONError(request) {
  this.name = 'ContentTypeNotJSONError';
  this.message = 'Request Content-Type must be application/json.'
  Error.call(this, this.message);
  Error.captureStackTrace(this, arguments.callee);
}

util.inherits(ContentTypeNotJSONError, Error);

/**
 * Error Handlers
 */

var error_codes = {
  'ContentTypeNotJSONError': 400, 
  'DataNotObjectError': 400,
  'InvalidIdError': 400,
  'JSONValidationError': 400,
  'SyntaxError': 400,
  'QueueNotFoundError': 404
}

app.error(function (err, request, response, next) {
  var status = error_codes[err.name];
  if (status) {
    response.send(err, status);
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
 * client.model[queue]
 * $ curl -XGET http://hostname:port/work
 */

app.get('/:queue', function (request, response) {
  var queue = client.model[request.params.queue];
  if (!queue) throw new norq.QueueNotFoundError();
  response.send(queue, 200); 
});

/**
 * client.push
 * $ curl -XPOST http://hostname:port/work -d '{...}' -H 'Content-Type: application/json'
 */

app.post('/:queue', function (request, response) {
  if (!request.is('json')) throw new ContentTypeNotJSONError(request);
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
  if (!request.is('json')) throw new ContentTypeNotJSONError(request);
  client.set(params.queue, params.id, request.body, function (err, result) {
    if (err) throw err;
    response.send(result, 200);
  });
});

/**
 * client.remove
 * curl -XDELETE http://hostname:port/work/id
 */

app.del('/:queue/:id', function (request, response) {
  var params = request.params;
  client.remove(params.queue, params.id, function (err, result) {
    if (err) throw err;
    response.send({ _id: params.id, deleted: true }, 200);
  });
});

// Only listen on $ node app.js
if (!module.parent) {
  app.listen(3000);
  console.log('Norq HTTP Interface listening on port %d', app.address().port);
}
