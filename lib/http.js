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
 * HTTP API FOR NORQ
 */

app.get('/', function (req, res) {
  res.send({ message: 'hello!'});  
});


/**
 * client.push
 * $ curl -XPOST http://hostname:port/work -d '{...}'
 */

app.post('/:queue', function (request, response) {
  client.push(request.params.queue, request.body, function (err, result) {
    if (err) { 
      response.send({ error: err.message }, 400);
    } else {
      response.send(result, 201);
    }
  }); 
});

/**
 * client.peek
 * $ curl -XGET http://hostname:port/work/next
 */

app.get('/:queue/next', function (request, response) {
  client.peek(request.params.queue, function (err, result) {
    if (err) {
      response.send({ error: err.message}, 404);
    } else {
      response.send(JSON.parse(result), 200); 
    }
  }); 
});

/**
 * client.pop
 * $ curl -XDELETE http://hostname:port/work/next
 */

app.del('/:queue/next', function (request, response) {
  client.pop(request.params.queue, function (err, result) {
    if (err) {
      response.send({ error: err.message }, 404);
    } else {
      response.send(JSON.parse(result), 200);
    }
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
    if (err) {
      response.send({ error: err.message }, 404);
    } else {
      response.send(results.map(function (item) {
        return JSON.parse(item);
      }), 200);
    }
  });
});

/**
 * client.head
 * $ curl -XGET http://hostname:port/work/+5
 */

app.get(/^\/([\w-]+)\/\+(\d+)/, function (request, response) {
  var params = request.params;
  client.head(params[0], params[1], function (err, results) {
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
    response.send(JSON.parse(result), 200); 
  }); 
});

/**
 * client.set
 * $ curl -XPUT http://hostname:port/work/id -d '{ _id: id, ... }'
 */

app.put('/:queue/:id', function (request, response) {
  var params = request.params;
  client.set(params.queue, params.id, request.body, function (err, result) {
    response.send(result, 200);
  }); 
});

// Only listen on $ node app.js
if (!module.parent) {
  app.listen(3000);
  console.log('Norq HTTP Interface listening on port %d', app.address().port);
}




// sketch
/*
function errorResponse (err) {
  var response = {};
  if (err instanceof Error) {
    switch(err.message) {
      case '?':
        response = { status: 404, error: { error: err.message }};
        break;
     
      case '?':
        response = { status: 400, error: { error: err.message }};
        break;
      
      default:
        response = { status: 500, error: { error: 'internal server error' }}; 
    }
  }
  return response;
}*/

