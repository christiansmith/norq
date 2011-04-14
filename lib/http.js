var express = require('express');
var norq = require('./norq');
//var client = norq.createClient({ test: { name: 'test' }});

var client = norq.createClient({ 
  pusher: { name: 'pusher' },
  peeker: { name: 'peeker' },
  popper: { name: 'popper' },
  longer: { name: 'longer' },
});

var app = module.exports = express.createServer();

app.use(express.bodyParser());


app.get('/', function (req, res) {
  res.send({ message: 'hello!'});  
});

// norq push
app.post('/:queue', function (request, response) {
  client.push(request.params.queue, request.body, function (err, result) {
    if (err) { 
      response.send({ error: err.message }, 400);
    } else {
      response.send(result, 201);
    }
  }); 
});

// norq peek
app.get('/:queue/next', function (request, response) {
  client.peek(request.params.queue, function (err, result) {
    if (err) {
      response.send({ error: err.message}, 404);
    } else {
      response.send(JSON.parse(result), 200); 
    }
  }); 
});

// norq pop
app.del('/:queue/next', function (request, response) {
  client.pop(request.params.queue, function (err, result) {
    if (err) {
      response.send({ error: err.message }, 404);
    } else {
      response.send(JSON.parse(result), 200);
    }
  }); 
});

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

if (!module.parent) {
  app.listen(3000);
}
