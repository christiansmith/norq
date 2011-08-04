/* 
 * Test with expresso 
 */

var app = require('../lib/http'),
    norq = require('../lib/norq'),
    assert = require('assert'),
    redis = require('redis').createClient();

redis.select(15);

/**
 * Define a model for testing purposes.
 */

var test_config = {
    redis: { db: 15 },
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
app.norq_client.client.select(15);

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
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }}, 
      function (res) {
        assert.includes(res.body, JSON.stringify({ norq: 'Welcome', version: '0.0.0' }));
      });
  },

  'GET /model': function () {
    assert.response(app,
      { url: '/model' },
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }}, 
      function (res) {
        assert.includes(res.body, JSON.stringify(test_config.model));
      });
  },

  'GET /queue/schema': function () {
    assert.response(app,
      { url: '/validator/schema' },
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }}, 
      function (res) {
        assert.includes(res.body, JSON.stringify(test_config.model.validator.schema));
      });
  },

  'PUT /:queue': function() {
    assert.response(app, 
      { url: '/pusher', 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ description: 'about', quantity: 123 }) },
      { status: 201, headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      function (res) {
        assert.eql(JSON.parse(res.body).status, [1, "OK"]);
      });
  },

  'GET /:queue': function() {
    redis.flushdb(function (err, result) {
      client.push('peeker', { _id: 123 }, function (err, result) {
        assert.response(app, 
          { url: '/peeker' }, 
          { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }}, 
          function (res) {
            assert.eql(JSON.parse(res.body)._id, 123);
          });
      });
    });
  },

  'DELETE /:queue': function() {
      client.push('popper', { _id: 1234 }, function (err, result) {
        assert.response(app, 
          { url: '/popper', method: 'DELETE' }, 
          { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }}, 
          function (res) {
            assert.eql(JSON.parse(res.body)._id, 1234);
          });
      });
  },

  // size       GET /:queue/stats
  

  'GET /:queue/0..9': function () {
    assert.response(app,
      { url: '/longer/0..9' },
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      function (res) {
        assert.eql(JSON.parse(res.body)[0]._id, 10);
      }); 
  },

  'GET /:queue/head': function () {
    assert.response(app,
      { url: '/longer/head?limit=2' },
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      function (res) {
        assert.eql(JSON.parse(res.body).length, 2);
      });
  },

  'GET /:queue/tail': function () {
    assert.response(app,
      { url: '/longer/tail?limit=2' },
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      function (res) {
        assert.eql(JSON.parse(res.body).length, 2);
      });
  },

  'GET /:queue/:id': function() {
    var data = { _id: 333 };
    client.push('getter', data, function (err, result) {
      assert.response(app,
        { url: '/getter/333' },
        { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }},
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
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          data: JSON.stringify(updated) },
        { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }},
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
          headers: { 'Content-Type': 'application/json; charset=utf-8' }},
        { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }},
        function (res) {
          assert.eql(res.body, JSON.stringify({ _id:'deleteme', deleted: true }));
        });      
    });
  },

  '400 Bad Request Errors - ContentTypeNotJSONError': function() {
    var requests = [
      { url: '/pusher', 
        method: 'PUT', 
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
        req, { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' }}, assertion);
    });
  },

  '400 Bad Request Errors - DataNotObjectError': function() {
    var requests = [
      { url: '/pusher', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        data: '1234'},

      { url: '/setter/777', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        data: '1234'} 
    ];
 
    function assertion (res) {
      assert.eql(JSON.parse(res.body).message, 'Data must be an object.');
    }
    
    requests.forEach(function (req) {
      assert.response(app,
        req, { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' }}, assertion);
    });
  },

  '400 Bad Request Error - InvalidIdError': function () {
    assert.response(app,
      { url: '/setter/789',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        data: '{ "_id": 123 }'},
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      function (res) {
        assert.eql(JSON.parse(res.body).message, 
                   'Data must have an _id property that matches the id argument.');
      });
  },

  '400 Bad Request Errors = JSONInvalidError': function () {
    var invalid_data = JSON.stringify({ _id: 456, description: {} });

    var requests = [
      { url: '/validator', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        data: invalid_data },

      { url: '/validator/456', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
        req, { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' }}, assertion);
    });
  },

  '400 Bad Request Errors = SyntaxError': function () {
    var invalid_json = '{ description: {} }';

    var requests = [
      { url: '/validator', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        data: invalid_json },

      { url: '/validator/456', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        data: invalid_json } 
    ];
 
    function assertion (res) {
      assert.eql(JSON.parse(res.body).message, 'Unexpected token ILLEGAL');
    }
    
    requests.forEach(function (req) {
      assert.response(app,
        req, { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' }}, assertion);
    });
  },


  '404 Not Found Errors - QueueNotFoundError': function () {
    var requests = [
      { url: '/undefined', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      
      { url: '/undefined', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        data: '{}'},
      
      { url: '/undefined/next', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      
      { url: '/undefined/next', 
        method: 'DELETE', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      
      { url: '/undefined/0..9', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      
      { url: '/undefined/+100', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      
      { url: '/undefined/-100', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      
      { url: '/undefined/uuid', 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' }},
      
      { url: '/undefined/uuid', 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        data: '{}'},
      
      { url: '/undefined/uuid', 
        method: 'DELETE', 
        headers: { 'Content-Type': 'application/json; charset=utf-8' }}
    ];

    function assertion (res) {
      assert.eql(JSON.parse(res.body).message, 'Queue not found.');
    }
  
    requests.forEach(function (req) {
      assert.response(app,
        req, { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' }}, assertion);
    });

  }

};
