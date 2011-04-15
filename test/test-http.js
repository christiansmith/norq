/* 
 * Test with expresso 
 */

var app = require('../lib/http'),
    norq = require('../lib/norq'),
    assert = require('assert'),
    redis = require('redis').createClient();

var client = norq.createClient({ 
  pusher: { name: 'pusher' },
  peeker: { name: 'peeker' },
  popper: { name: 'popper' },
  longer: { name: 'longer' },
});

function setupQueue (queue, len) {
  if (len > 0) {
    client.push(queue, { _id: len }, function (err, result) {
      setupQueue(queue, len - 1);
    });
  } else {
    return;
  }      
};

setupQueue('longer', 10);

module.exports = {

  'GET /': function() {
    assert.response(app, 
      { url: '/' }, 
      { status: 200, headers: { 'Content-Type': 'application/json' }}, 
      function (res) {
        assert.includes(res.body, JSON.stringify({ message: 'hello!' }));
      });
  },

  


  // test cases
  // model
  // config?
  // info       GET /
  // info       GET /queue
  // push       POST /queue
  'POST /:queue': function() {
    assert.response(app, 
      { url: '/pusher', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ description: 'about', quantity: 123 }) },
      { status: 201, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).status, [1, "OK"]);
      });
  },
  
  'POST /:queue ERROR': function() {
    assert.response(app, 
      { url: '/pusher', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: '1234' },
      { status: 400, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).error, "Data must be an object.");
      });
  },


  // peek       GET /queue/next
  'GET /:queue/next': function() {
    redis.flushdb(function (err, result) {
      client.push('peeker', { _id: 123 }, function (err, result) {
        assert.response(app, 
          { url: '/peeker/next' }, 
          { status: 200, headers: { 'Content-Type': 'application/json' }}, 
          function (res) {
            assert.eql(JSON.parse(res.body)._id, 123);
          });
      });
    });
  },

  'GET /:queue/next ERROR': function() {
    assert.response(app, 
      { url: '/notaqueue/next' },
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).error, 'Queue not found.');
      });
  },


  // pop        DELETE /queue/next
  'DELETE /:queue/next': function() {
      client.push('popper', { _id: 1234 }, function (err, result) {
        assert.response(app, 
          { url: '/popper/next', method: 'DELETE' }, 
          { status: 200, headers: { 'Content-Type': 'application/json' }}, 
          function (res) {
            assert.eql(JSON.parse(res.body)._id, 1234);
          });
      });
  },

  'DELETE /:queue/next ERROR': function () {
    assert.response(app,
      { url: '/notaqueue/next', method: 'DELETE' },
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).error, 'Queue not found.');
      });
  },


  // size       GET /:queue/stats
  // range      GET /:queue/0..-1
  'GET /:queue/0..9': function () {
    assert.response(app,
      { url: '/longer/0..9' },
      { status: 200, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body)[0]._id, 10);
      }); 
  },

  'GET /:queue/0..9 ERROR': function() {
    assert.response(app,
      { url: '/notaqueue/0..4' },
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).error, 'Queue not found.');
      });
  },

  // head       GET /:queue/+100
  'GET /:queue/+5': function () {
    assert.response(app,
      { url: '/longer/+5' },
      { status: 200, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).length, 5);
      });
  },

  // tail       GET /:queue/100-

  'GET /:queue/-5': function () {
    assert.response(app,
      { url: '/longer/-5' },
      { status: 200, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).length, 5);
      });
  },
  // get        GET /:queue/:id
  // set        PUT /:queue/:id -d
  // remove     DELETE /:queue/:id

};
