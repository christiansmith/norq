/*
 * Copyright(c) 2011 Christian Smith <smith@anvil.io>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * Module dependencies.
 */

var express = require('express')
  , util = require('util')
  , winston = require('winston')
  , logger = require('./logger').logger
  , norq = require('./norq');

/**
 * Initialize a new HTTPServer instance.
 */

var app = module.exports = express.createServer();

/**
 * Initialize a new `NorqClient` and
 * make instance available to be overridden.
 */

var client = app.norq_client = norq.createClient({});

/**
 * Configure the server.
 *
 * (logger gets spliced into the stack later)
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
  // malformed JSON throws this one:
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

app.get('/', function (request, response) {
  response.send({ norq: 'Welcome', version: '0.0.0' }, 200);  
});

/**
 * Model defined for this server
 */

app.get('/model', function (request, response) {
  response.send(client.model, 200);
});

/**
 * Schema for a queue
 */

app.get('/:queue/schema', function (request, response) {
  var queue = client.model[request.params.queue];
  if (!queue) throw new norq.QueueNotFoundError();
  response.send(queue.schema, 200); 
});

/**
 * QUEUE OPERATIONS 
 *
 * Push
 */

app.put('/:queue', function (request, response) {
  if (!request.is('json')) throw new ContentTypeNotJSONError(request);
  client.push(request.params.queue, request.body, function (err, result) {
    if (err) throw err; 
    response.send(result, 201);
  }); 
});

/**
 * Peek
 */

app.get('/:queue', function (request, response) {
  client.peek(request.params.queue, function (err, result) {
    if (err) throw err;
    response.send(JSON.parse(result), 200);
  }); 
});

/**
 * Pop
 */

app.del('/:queue', function (request, response) {
  client.pop(request.params.queue, function (err, result) {
    if (err) throw err;
    response.send(JSON.parse(result), 200);
  }); 
});

/**
 * LIST OPERATIONS
 *
 * Range
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
 * Head
 */

app.get('/:queue/head', function (request, response) {
  var queue = request.params.queue
    , limit = request.query.limit || 10;
  client.head(queue, limit, function (err, results) {
    if (err) throw err;
    response.send(results.map(function (item) {
      return JSON.parse(item);
    }), 200);
  });
});

/**
 * Tail
 */

app.get('/:queue/tail', function (request, response) {
  var queue = request.params.queue
    , limit = request.query.limit || 10;
  client.tail(queue, limit, function (err, results) {
    if (err) throw err;
    response.send(results.map(function (item) {
      return JSON.parse(item);
    }), 200);
  });
});

/**
 * RANDOM ACCESS OPERATIONS
 *
 * Get
 */

app.get('/:queue/:id', function (request, response) {
  var params = request.params;
  client.get(params.queue, params.id, function (err, result) {
    if (err) throw err;
    response.send(JSON.parse(result), 200); 
  }); 
});

/**
 * Set
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
 * Remove
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
  app.listen(5150);
  console.log('Norq HTTP Interface listening on port %d', app.address().port);
}
