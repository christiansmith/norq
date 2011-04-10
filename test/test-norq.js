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
       // wait a few milliseconds to guarantee the order
       // this is not happening
       // wtf?
       setTimeout(setupQueue(client, queue, len - 1, callback), 100000);
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

  'passes value to a callback': function (test) {
    test.expect(2);
    this.client.pop('work', function (err, result) {
      test.equal(err, null);
      test.equal(JSON.parse(result)._id, 10);
      test.done();
    });   
  },
  
  'removes item from sorted set': function (test) {
    test.expect(2);
    this.client.pop('work', function (err, result) {
      redis_client.multi()
        .zcard('work')
        .zrange('work', 0, 0)
        .exec(function (err, result) {
           test.equal(result[0], 9);
           test.notEqual(result[1], 10);
           test.done();
        });
    });
  },

  'deletes key storing the value': function (test) {
    test.expect(1);
    this.client.pop('work', function (err, result) {
      var key = 'work:' + JSON.parse(result)._id;
      redis_client.get(key, function (err, result) {
        test.equal(result, null);      
        test.done();
      }); 
    });
  },
  
  // test empty queue returns null
  // test errors
  
});


exports['peek'] = nodeunit.testCase({

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

  'passes the value of the first item to a callback': function (test) {
    test.expect(1);
    this.client.peek('work', function (err, result) {
      test.equal(result, JSON.stringify({ _id: 10 }));
      test.done();
    });
  },
  
});


exports['size'] = nodeunit.testCase({

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
  'passes number of elements in the sorted set to callback': function (test) {
    test.expect(1);
    this.client.size('work', function (err, result) {
      test.equal(result, 10);
      test.done();
    });
  },
  
});


exports['range'] = nodeunit.testCase({

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

  'passes a range of items by index to callback': function (test) {
    test.expect(2);
    this.client.range('work', 0, 4, function (err, result) {
      test.equal(result.length, 5);
      test.equal(result[0], JSON.stringify({ _id: 10 }));
      test.done();
    });
  },

});


exports['head'] = nodeunit.testCase({

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

  'passes the first n values in the queue to callback': function (test) {
    test.expect(2);
    this.client.head('work', 5, function (err, result) {
      test.equal(result.length, 5);
      test.equal(result[0], JSON.stringify({ _id: 10 }));
      test.done();
    });
  },
  
});

exports['tail'] = nodeunit.testCase({

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

  'passes the last n values in the queue to callback in reverse order': function (test) {
    test.expect(2);
    this.client.tail('work', 5, function (err, result) {
      test.equal(result.length, 5);
      test.notEqual(result[0], JSON.stringify({ _id: 10 }));
      test.done();
    });
  },
  
});



exports['get'] = nodeunit.testCase({

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

  'returns the value of a key': function (test) {
    test.expect(1);
    this.client.get('work', 5, function (err, result) {
      test.equal(result, JSON.stringify({ _id: 5 }));
      test.done();
    });
  },
  
});



exports['set'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.model = { work: { name: 'work' }};
    this.client = norq.createClient(this.model);
    this.update = { _id: 10, update: 'some value' };
    setupQueue(this.client, 'work', 10, function () {
      callback();
    });
  },

  tearDown: function (callback) {
    
    callback();
  },

  'requires queue to be defined in model': function (test) {
    test.expect(1);
    this.client.set('nada', 10, {}, function (err, result) {
      test.equal(err.message, "Queue not found.");
      test.done();
    }); 
  },
  
  'requires data to be an object': function (test) {
    test.expect(1);
    this.client.set('work', 10, undefined, function (err, result) {
      test.equal(err.message, "Data must be an object."); 
      test.done();
    });  
  },

  'requires data to not be null': function (test) {
    test.expect(1);
    this.client.set('work', 10, null, function (err, result) {
       test.equal(err.message, "Data must be an object.");
       test.done();
    });
  },

  'requires data to have an _id property': function (test) {
    test.expect(1);
    this.client.set('work', 10, {}, function (err, result) {
      test.equal(err.message, "Data must have an _id property that matches the id argument.");
      test.done();
    });
  },
  
  'requires data._id to match id argument': function (test) {
    test.expect(1);
    this.client.set('work', 10, { _id: 123 }, function (err, result) {
      test.equal(err.message, "Data must have an _id property that matches the id argument.");
      test.done();
    });
  },

  'passes _id and status to the callback result': function (test) {
    test.expect(3);
    var that = this;
    this.client.set('work', this.update._id, this.update, function (err, result) {
      test.equal(err, null);
      test.equal(result._id, that.update._id);
      test.equal(result.status, 'OK');
      test.done();
    });
  },

  'updates the value of an existing queue item': function (test) {
    test.expect(1);
    var that = this;
    var id = 10, key = 'work:10';
    this.client.set('work', id, this.update, function (err, result) {
      redis_client.get(key, function (err, result) {
        test.equal(result, JSON.stringify(that.update));
        test.done();
      });    
    });
  },


  // validates data against a json-schema
  
  // validates that data is json
  

});


exports['remove'] = nodeunit.testCase({

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


  'removes item from sorted set': function (test) {
    test.expect(3);
    this.client.remove('work', 5, function (err, result) {
      redis_client.multi()
        .zcard('work')
        .zrank('work', 5) 
        .exec(function (err, result) {
           test.equal(result[0], 9); 
           test.equal(result[1], null);
           test.notEqual(result[1], 5); 
           test.done();
        });
    });
  },
  
  'deletes key storing the value': function (test) {
    test.expect(1);
    this.client.remove('work', 5, function (err, result) {
      var key = 'work:5';
      redis_client.get(key, function (err, result) {
        test.equal(result, null);      
        test.done();
      }); 
    });
  },
  
  'passes redis results to a callback': function (test) {
    test.expect(3);
    this.client.remove('work', 5, function (err, results) {
      test.equal(err, null);
      test.equal(results[0], 1);
      test.equal(results[1], 1);
      test.done();
    });   
  },

  // test errors
  
});


