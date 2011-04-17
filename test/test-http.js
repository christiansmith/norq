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
  getter: { name: 'getter' },
  setter: { name: 'setter' }
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

  // info       GET /
  'GET /': function() {
    assert.response(app, 
      { url: '/' }, 
      { status: 200, headers: { 'Content-Type': 'application/json' }}, 
      function (res) {
        assert.includes(res.body, JSON.stringify({ message: 'hello!' }));
      });
  },

  // info       GET /queue
  'GET /:queue': function () {
    assert.response(app, 
      { url: '/longer' },
      { status: 200, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(res.body, JSON.stringify(client.model['longer']));
      });
  },

  'GET /:queue 404': function () {
    assert.response(app, 
      { url: '/notaqueue' },
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.includes(res.body, 'Queue not found.');
      });
  },

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
  
  'POST /:queue 404': function() {
    assert.response(app, 
      { url: '/notaqueue', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ description: 'about', quantity: 123 }) },
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 'Queue not found.');
      });
  },

  'POST /:queue 400': function() {
    assert.response(app, 
      { url: '/pusher', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: '1234' },
      { status: 400, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, "Data must be an object.");
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

  'GET /:queue/next 404': function() {
    assert.response(app, 
      { url: '/notaqueue/next' },
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 'Queue not found.');
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

  'DELETE /:queue/next 404': function () {
    assert.response(app,
      { url: '/notaqueue/next', method: 'DELETE' },
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 'Queue not found.');
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

  'GET /:queue/0..9 404': function() {
    assert.response(app,
      { url: '/notaqueue/0..4' },
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 'Queue not found.');
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

  'GET /:queue/+5 404': function () {
    assert.response(app, 
      { url: '/notaqueue/+5' }, 
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 'Queue not found.');
      });
  },

  // tail       GET /:queue/-100

  'GET /:queue/-5': function () {
    assert.response(app,
      { url: '/longer/-5' },
      { status: 200, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).length, 5);
      });
  },

  'GET /:queue/-5 404': function () {
    assert.response(app, 
      { url: '/notaqueue/-5' }, 
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 'Queue not found.');
      });
  },

  // get        GET /:queue/:id
  'GET /:queue/:id': function() {
    var data = { _id: 333 };
    client.push('getter', data, function (err, result) {
      assert.response(app,
        { url: '/getter/333' },
        { status: 200, headers: { 'Content-Type': 'application/json' }},
        function (res) {
          assert.eql(res.body, JSON.stringify(data));
        });
    });
  },

  'GET /:queue/:id 404': function () {
    assert.response(app, 
      { url: '/notaqueue/86' },
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 'Queue not found.');
      });
  },

  // set        PUT /:queue/:id -d
  'PUT /:queue/:id': function() {
    var data = { _id: '555' },
        updated = { _id: '555', wtf: false };

    client.push('setter', data, function (err, result) {
      assert.response(app,
        { url: '/setter/555', 
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(updated) },
        { status: 200, headers: { 'Content-Type': 'application/json' }},
        function (res) {
          assert.eql(res.body, JSON.stringify({ _id:'555', status: 'OK' }));
        });      
    });
  },

  'PUT /:queue/:id 404': function () {
    assert.response(app, 
      { url: '/notaqueue/86', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json'},
        data: JSON.stringify({ _id: 86 })},
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 'Queue not found.');
      });
  },

  // remove     DELETE /:queue/:id
  'DELETE /:queue/:id': function() {
    var data = { _id: 'deleteme' };

    client.push('setter', data, function (err, result) {
      assert.response(app,
        { url: '/setter/deleteme', 
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }},
        { status: 200, headers: { 'Content-Type': 'application/json' }},
        function (res) {
          assert.eql(res.body, JSON.stringify({ _id:'deleteme', deleted: true }));
        });      

    });
  },

  'DELETE /:queue/:id 404': function () {
    assert.response(app, 
      { url: '/notaqueue/86', 
        method: 'DELETE', 
        headers: { 'Content-Type': 'application/json'}},
      { status: 404, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 'Queue not found.');
      });
  },

  // other
  'push and set requests need application/json for Content-Type': function() {
    assert.response(app, 
      { url: '/pusher', 
        method: 'POST', 
        headers: { 'Content-Type': 'text/html' },
        data: '{}'},
      { status: 400 },
      function (res) {
        assert.eql(JSON.parse(res.body).message, 
                   'Request Content-Type must be application/json.');
      });

    client.push('setter', '777', function (err, result) {
      assert.response(app, 
        { url: '/setter/777', 
          method: 'PUT', 
          headers: { 'Content-Type': 'text/html' },
          data: '{ _id: 777 }'},
        { status: 400 },
        function (res) {
          assert.eql(JSON.parse(res.body).message, 
                     'Request Content-Type must be application/json.');
        }); 
    });
  },

};
