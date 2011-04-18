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

  // head       GET /:queue/+100
  'GET /:queue/+5': function () {
    assert.response(app,
      { url: '/longer/+5' },
      { status: 200, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).length, 5);
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

  '400 Bad Request Errors - ContentTypeNotJSONError': function() {
    var requests = [
      { url: '/pusher', 
        method: 'POST', 
        headers: { 'Content-Type': 'text/html' },
        data: '{}'},

      { url: '/setter/777', 
        method: 'PUT', 
        headers: { 'Content-Type': 'text/html' },
        data: '{ _id: 777 }'} 
    
    ];
 
    function assertion (res) {
      assert.eql(JSON.parse(res.body).message, 
                 'Request Content-Type must be application/json.');
    }
    
    requests.forEach(function (req) {
      assert.response(app,
        req, { status: 400, headers: { 'Content-Type': 'application/json' }}, assertion);
    });
  },

  '400 Bad Request Errors - DataNotObjectError': function() {
    var requests = [
      { url: '/pusher', 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        data: '1234'},

      { url: '/setter/777', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        data: '1234'} 
    
    ];
 
    function assertion (res) {
      assert.eql(JSON.parse(res.body).message, 'Data must be an object.');
    }
    
    requests.forEach(function (req) {
      assert.response(app,
        req, { status: 400, headers: { 'Content-Type': 'application/json' }}, assertion);
    });
  },

  '404 Not Found Errors - QueueNotFoundError': function () {
    var requests = [
      { url: '/undefined', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' }},
      
      { url: '/undefined', 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        data: '{}'},
      
      { url: '/undefined/next', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' }},
      
      { url: '/undefined/next', 
        method: 'DELETE', 
        headers: { 'Content-Type': 'application/json' }},
      
      { url: '/undefined/0..9', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' }},
      
      { url: '/undefined/+100', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' }},
      
      { url: '/undefined/-100', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' }},
      
      { url: '/undefined/uuid', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' }},
      
      { url: '/undefined/uuid', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        data: '{}'},
      
      { url: '/undefined/uuid', 
        method: 'DELETE', 
        headers: { 'Content-Type': 'application/json' }}
    ];

    function assertion (res) {
      assert.eql(JSON.parse(res.body).message, 'Queue not found.');
    }
  
    requests.forEach(function (req) {
      assert.response(app,
        req, { status: 404, headers: { 'Content-Type': 'application/json' }}, assertion);
    });

  }

};
