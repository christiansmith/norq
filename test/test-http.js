/* 
 * Test with expresso 
 */

var app = require('../lib/http'),
    norq = require('../lib/norq'),
    assert = require('assert'),
    redis = require('redis').createClient();

/**
 * Define a model for testing purposes.
 */

var test_config = {
    model: {
      pusher: { name: 'pusher' }
    , peeker: { name: 'peeker' }
    , popper: { name: 'popper' }
    , longer: { name: 'longer' }
    , getter: { name: 'getter' }
    , setter: { name: 'setter' }
    , validator: { 
        name: 'validator' 
      , schema: { 
          type: 'object'
        , properties: {
            description: { type: 'String' }
          , quantity: { type: 'Number' }
          }
        }
      }        
    }
};

/**
 * Create a NorqClient for use in tests.
 */

var client = norq.createClient(test_config);

/**
 * Override the model in app.norq_client for testing.
 */

app.norq_client.model = test_config.model;

/**
 * Add some items to a queue for testing range, head and tail.
 */

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

/**
 * Tests
 */

module.exports = {

  'GET /': function() {
    assert.response(app, 
      { url: '/' }, 
      { status: 200, headers: { 'Content-Type': 'application/json' }}, 
      function (res) {
        assert.includes(res.body, JSON.stringify({ message: 'hello!' }));
      });
  },

  'GET /:queue': function () {
    assert.response(app, 
      { url: '/longer' },
      { status: 200, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(res.body, JSON.stringify(client.model['longer']));
      });
  },

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
  

  'GET /:queue/0..9': function () {
    assert.response(app,
      { url: '/longer/0..9' },
      { status: 200, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body)[0]._id, 10);
      }); 
  },

  'GET /:queue/+5': function () {
    assert.response(app,
      { url: '/longer/+5' },
      { status: 200, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).length, 5);
      });
  },

  'GET /:queue/-5': function () {
    assert.response(app,
      { url: '/longer/-5' },
      { status: 200, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).length, 5);
      });
  },

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

  '400 Bad Request Error - InvalidIdError': function () {
    assert.response(app,
      { url: '/setter/789',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        data: '{ "_id": 123 }'},
      { status: 400, headers: { 'Content-Type': 'application/json' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 
                   'Data must have an _id property that matches the id argument.');
      });
  },

  '400 Bad Request Errors = JSONInvalidError': function () {
    var invalid_data = JSON.stringify({ _id: 456, description: {} });

    var requests = [
      { url: '/validator', 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        data: invalid_data },

      { url: '/validator/456', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        data: invalid_data } 
    ];
 
    function assertion (res) {
      assert.eql(JSON.parse(res.body).message[0].message, 
                            'object value found, but a String is required');
      assert.eql(JSON.parse(res.body).message[1].message, 
                            'is missing and it is not optional');
    }
    
    requests.forEach(function (req) {
      assert.response(app,
        req, { status: 400, headers: { 'Content-Type': 'application/json' }}, assertion);
    });
  },

  '400 Bad Request Errors = SyntaxError': function () {
    var invalid_json = '{ description: {} }';

    var requests = [
      { url: '/validator', 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        data: invalid_json },

      { url: '/validator/456', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        data: invalid_json } 
    ];
 
    function assertion (res) {
      assert.eql(JSON.parse(res.body).message, 'Unexpected token ILLEGAL');
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
