var nodeunit = require('nodeunit'),
    norq = require('../lib/norq'),
    redis = require('redis'),
    redis_client = redis.createClient();


exports['norq client object'] = nodeunit.testCase({

  setUp: function (callback) {
      this.model = { work: { name: 'work' }};
      this.redis_client = redis.createClient();
      this.norq_client = new norq.NorqClient(this.model, this.redis_client);
      callback();
  },

  tearDown: function (callback) {
    this.redis_client.quit();
    callback();
  },

  'is an instance of NorqClient': function (test) {
    test.expect(1);
    test.ok(this.norq_client instanceof norq.NorqClient);
    test.done();
  },

  'has a model property': function (test) {
    test.expect(1);
    test.ok(this.norq_client.model);
    test.done();
  },

  'requires a model object': function (test) {
    test.expect(1);
    test.throws(function () { new norq.NorqClient(); }, Error);
    test.done();
  },
  
  'has a client property': function (test) {
    test.expect(1);
    test.ok(this.norq_client.client);
    test.done();
  },
 
  'requires a RedisClient object': function (test) {
    test.expect(1);
    // can't get this test to break. Suspect I'm not using throws correctly.
    test.throws(function () { new norq.NorqClient(this.model)}, Error);
    test.done();
  }

});

exports['createClient'] = nodeunit.testCase({

  setUp: function (callback) {
    this.model = { work: { name: 'work' }};
    this.config = {};
    this.client = norq.createClient(this.model, this.config);  
    callback();
  },

  tearDown: function (callback) {
    callback();
  },

  'returns a NorqClient instance': function (test) {
    test.expect(1);
    test.ok(this.client instanceof norq.NorqClient);
    test.done();
  },

});


exports['push'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.model = { work: { name: 'work' }};
    this.client = norq.createClient(this.model);  
    callback();
  },

  tearDown: function (callback) {
    callback();
  },

  'requires queue to be defined in model': function (test) {
    test.expect(1);
    this.client.push('nada', {}, function (err, result) {
      test.equal(err.message, "Queue not found.");
      test.done();
    }); 
  },
  

  'requires data to be an object': function (test) {
    test.expect(1);
    this.client.push('work', undefined, function (err, result) {
      test.equal(err.message, "Data must be an object."); 
      test.done();
    });  
  },

  'requires data to not be null': function (test) {
    test.expect(1);
    this.client.push('work', null, function (err, result) {
       test.equal(err.message, "Data must be an object.");
       test.done();
    });
  },
  
  
  /*

  'validates data against a json-schema': function (test) {
    test.expect(1);
    
    test.done();
  },
  

  'passes an error to callback if data is not valid': function (test) {
    test.expect(1);
    
    test.done();
  },

  */

  'passes data._id to callback': function (test) {
    test.expect(1);
    this.client.push('work', { _id: 'g1bb3r1sh' }, function (err, result) {
      test.equal(result._id, 'g1bb3r1sh'); 
      test.done();
    });
  },
  
  'generates id if data is unidentified': function (test) {
    test.expect(1);
    this.client.push('work', {}, function (err, result) {
      test.equal(typeof result._id, 'string'); 
      test.done();
    }); 
  },

  'adds _id to sorted set scored by timestamp': function (test) {
    test.expect(1);
    this.client.push('work', { _id: 'asdf' }, function (err, result) {
      redis_client.zrank('work', 'asdf', function (err, rank) {
        test.equal(rank, 0);
        test.done();
      }); 
    })
  },

  'sets a queue:id key in redis the string value of data': function (test) {
    test.expect(1);
    var data = { _id: 'sdfg' };
    this.client.push('work', data, function (err, result) {
      redis_client.get('work:sdfg', function (err, reply) {
        test.equal(reply, JSON.stringify(data));
        test.done();
      });  
    }); 
  },

  'passes object with id and redis replies to the callback': function (test) {
    test.expect(2);
    this.client.push('work', {}, function (err, result) {
      test.equal(typeof result._id, 'string');
      test.equal(result.status[1], "OK");
      test.done();
    })
  }

});

exports['push error'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.model = { work: { name: 'work' }};
    this.client = norq.createClient(this.model);  
    callback();
  },

  tearDown: function (callback) {
    callback();
  },

  'passes an error to callback if redis transaction fails': function (test) {
    test.expect(2);
    var client = norq.createClient({ wrong: { name: 'wrong' }});
    redis_client.set('wrong', 'contrived to test failure', function (err, res) {
      client.push('wrong', {}, function (err, result) {
        test.equal(true, true);
        test.equal(result, undefined);
        test.done();
      }); 
    });
  },
  
  // test key is deleted if zadd fails
  // think up a few more failure cases

});


function setupQueue(client, queue, len, callback) {
  if (len > 0) {
    client.push(queue, { _id: len }, function (err, result) {
       // wait a millisecond to guarantee the order
       setTimeout(setupQueue(client, queue, len - 1, callback), 1);
    });
  } else {
    callback();
  }
}

exports['pop'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.model = { work: { name: 'work' }};
    this.client = norq.createClient(this.model);
    setupQueue(this.client, 'work', 10, function () {
      callback();
    });
  },

  tearDown: function (callback) {
    
    callback();
  },

  // unit test
  'removes the first item on the list and sends it to the callback': function (test) {
    test.expect(1);
    redis_client.zcard('work', function (err, result) {
      test.equal(result, 10);
      test.done();
    }); 
  },
  
  
});

