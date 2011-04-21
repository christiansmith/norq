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



exports['methods taking queue as an argument'] = nodeunit.testCase({

  setUp: function (callback) {
    this.client = norq.createClient({});
    callback();
  },

  tearDown: function (callback) {
    callback();
  },

  'require queue to be defined in the model': function (test) {
    test.expect(20);

    var test = test; 
    var client = this.client; 

    ['push', 'peek', 'pop', 'size', 'range', 
     'head', 'tail', 'get', 'set', 'remove'].forEach(function (method) {
      
      var len = client[method].length;
      var args = ['not-defined'];
      
      for (var i = 0; i < len - 2; i++) {
        args.push(null);
      };

      args.push(function (err, result) {
        test.equal(err.message, 'Queue not found.');
        test.ok(err instanceof norq.QueueNotFoundError);
      });

      client[method].apply(client, args); 

    });

    test.done();
  },
  
});


exports['push and set methods'] = nodeunit.testCase({

  setUp: function (callback) {
    this.model = { work: { name: 'work' }};
    this.client = norq.createClient(this.model);  
    this.client.push('work', { _id: 'setfromstring' }, function () {
      callback();  
    });
    // callback();
  },

  tearDown: function (callback) {
    callback();
  },

  'require their data argument to be a non null object': function (test) {
    test.expect(8);
  
    function assertion (err, result) {
      test.equal(err.message, 'Data must be an object.');
      test.ok(err instanceof norq.DataNotObjectError);
    }

    var data = 'this is not an object';
    this.client.push('work', data, assertion);  
    this.client.set('work', '_', data, assertion);

    this.client.push('work', null, assertion);
    this.client.set('work', '_', null, assertion);
    
    test.done();
  },

  'will attempt to parse JSON string': function (test) {
    test.expect(4);
    
    var counter = 0;

    function assertion (err, result) {
      counter += 1;
      console.log(result);
      test.ok(!err);
      test.ok(result !== undefined);
      if (counter === 2) test.done();
    }

    var data = JSON.stringify({ _id: 'fromstring' });
    this.client.push('work', data, assertion);

    this.client.set('work', 'setfromstring', 
                     JSON.stringify({ _id: 'setfromstring', k: 'v' }), assertion);
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
      test.equal(result.status[1], 'OK');
      test.done();
    })
  }

});

exports['push error'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.error = 'ERR Operation against a key holding the wrong kind of value';
    this.client = norq.createClient({ wrong: { name: 'wrong' }});
    redis_client.set('wrong', 'contrived to test failure', function (err, res) {
      callback();
    });
  },

  tearDown: function (callback) {
    callback();
  },

  'passes an error to callback if redis transaction fails': function (test) {
    test.expect(2);
    var that = this;
    this.client.push('wrong', {}, function (err, result) {
      test.equal(err.message, that.error);
      test.equal(result, undefined);
      test.done();
    }); 
  },
  
  'deletes key if zadd fails': function (test) {
    test.expect(2);
    var that = this;
    this.client.push('wrong', { _id: 123 }, function (err, result) {
      test.equal(err.message, that.error);
      redis_client.get('wrong:123', function (err, result) {
        test.equal(result, null);
        test.done();
      });
    });    
  },
  
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

  'requires queue to be defined in model': function (test) {
    test.expect(1);
    this.client.pop('nada', function (err, result) {
      test.equal(err.message, 'Queue not found.');
      test.done();
    }); 
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
  
  'empty queue passes null to a callback': function (test) {
    test.expect(2);
    var client = this.client;
    redis_client.del('work', function (err, result) {
      client.pop('work', function (err, result) {
        test.equal(err, null);
        test.equal(result, null);
        test.done();
      });     
    });  
  },

});

exports['pop error'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.error = 'ERR Operation against a key holding the wrong kind of value';
    this.model = { wrong: { name: 'wrong' }}
    this.client = norq.createClient(this.model);
    redis_client.set('wrong', 'contrived to test failure', function (err, res) {
      callback();
    });
  },

  tearDown: function (callback) {
    callback();
  },
  
  'passes a zrange error to callback ': function (test) {
    test.expect(1);
    var that = this;
    this.client.pop('wrong', function (err, result) {
      test.equal(err.message, that.error);
      test.done();
    }); 
  },

  // passes a get error to callback
  // passes a remove error to callback

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
  
  'requires queue to be defined in model': function (test) {
    test.expect(1);
    this.client.peek('nada', function (err, result) {
      test.equal(err.message, 'Queue not found.');
      test.done();
    }); 
  },

});

exports['peek error'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.error = 'ERR Operation against a key holding the wrong kind of value';
    this.model = { wrong: { name: 'wrong' }}
    this.client = norq.createClient(this.model);
    redis_client.set('wrong', 'contrived to test failure', function (err, res) {
      callback();
    });
  },

  tearDown: function (callback) {
    callback();
  },

  'passes a zrange error to callback': function (test) {
    test.expect(1);
    var that = this;
    this.client.peek('wrong', function (err, result) {
      test.equal(err.message, that.error);
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

  'passes number of elements in the sorted set to callback': function (test) {
    test.expect(1);
    this.client.size('work', function (err, result) {
      test.equal(result, 10);
      test.done();
    });
  },
  
});


exports['size error'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.error = 'ERR Operation against a key holding the wrong kind of value';
    this.model = { wrong: { name: 'wrong' }}
    this.client = norq.createClient(this.model);
    redis_client.set('wrong', 'contrived to test failure', function (err, res) {
      callback();
    });
  },

  tearDown: function (callback) {
    callback();
  },

  'passes a zcard error to callback': function (test) {
    test.expect(1);
    var that = this;
    this.client.size('wrong', function (err, result) {
      test.equal(err.message, that.error);
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

exports['range error'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.error = 'ERR Operation against a key holding the wrong kind of value';
    this.model = { wrong: { name: 'wrong' }}
    this.client = norq.createClient(this.model);
    redis_client.set('wrong', 'contrived to test failure', function (err, res) {
      callback();
    });
  },

  tearDown: function (callback) {
    callback();
  },

  'passes a zrange error to callback': function (test) {
    test.expect(1);
    var that = this;
    this.client.range('wrong', 0, -1, function (err, result) {
      test.equal(err.message, that.error);
      test.done();
    });
  },

  // how to test mget failure?

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

exports['tail error'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.error = 'ERR Operation against a key holding the wrong kind of value';
    this.model = { wrong: { name: 'wrong' }}
    this.client = norq.createClient(this.model);
    redis_client.set('wrong', 'contrived to test failure', function (err, res) {
      callback();
    });
    // also need to setupQueue
  },

  tearDown: function (callback) {
    callback();
  },

  'passes a zcard error to callback': function (test) {
    test.expect(1);
    var that = this;
    this.client.tail('wrong', 5, function (err, result) {
      test.equal(err.message, that.error);
      test.done();
    });
  },

  // how to test that.range error?   

});

exports['range, head, and tail'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.model = { work: { name: 'work' }};
    this.client = norq.createClient(this.model);
    callback();
  },

  tearDown: function (callback) {
    callback();
  },

  'pass an empty array to callback if the queue is empty': function (test) {
    test.expect(6);

    var counter = 0;

    function assertions (err, results) {
      counter += 1;
      test.equal(err, null);
      test.equal(JSON.stringify(results), JSON.stringify([]));
      if (counter === 3) test.done();
    }

    this.client.range('work', 0, 9, assertions);
    this.client.head('work', 100, assertions);
    this.client.tail('work', 100, assertions);
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

exports['get error'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.error = 'ERR Operation against a key holding the wrong kind of value';
    this.model = { 'wrong:123': { name: 'wrong:123' }, 'wrong': { name: 'wrong' }};
    this.client = norq.createClient(this.model);
    this.client.push('wrong:123', {}, function (err, res) {
      callback();
    });
  },

  tearDown: function (callback) {
    callback();
  },

  'passes a redis error to callback': function (test) {
    test.expect(1);
    var that = this;
    this.client.get('wrong', 123, function (err, result) {
      test.equal(err.message, that.error);
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

  'requires data to have an _id property': function (test) {
    test.expect(2);
    this.client.set('work', 10, {}, function (err, result) {
      test.ok(err instanceof norq.InvalidIdError);
      test.equal(err.message, 
                'Data must have an _id property that matches the id argument.');
      test.done();
    });
  },
  
  'requires data._id to match id argument': function (test) {
    test.expect(1);
    this.client.set('work', 10, { _id: 123 }, function (err, result) {
      test.equal(err.message, 
                 'Data must have an _id property that matches the id argument.');
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

  // client.set error

});

exports['set error'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.error = 'ERR Operation against a key holding the wrong kind of value';
    this.model = { 'wrong:123': { name: 'wrong:123' }}
    this.client = norq.createClient(this.model);
    this.client.push('wrong:123', {}, function (err, res) {
      callback();
    });
  },

  tearDown: function (callback) {
    callback();
  },

  // not sure how to get this to throw an error in the 
  // right place for testing. by the time we get to the redis call
  // it will already have called back with an error elsewhere.
  /*
  'passes a redis error to callback': function (test) {
    test.expect(1);
    var that = this;
    this.client.set('wrong:123', '', { _id: '' }, function (err, result) {
      console.log('ERR: ' + err + ' RES: ' + result);
      test.equal(err.message, that.error);
      test.done();
    });
  },
  */

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
  // multi zrem error
  // del error
  
});


exports['validation'] = nodeunit.testCase({

  setUp: function (callback) {
    redis_client.flushdb();
    this.model_with_schema = { 
      work: { 
        name: 'work', 
        schema: { type: 'object',
                  properties: {
                    description: { type: 'string' },
                    quantity: { type: 'number' }
                  }
                } 
              }
            }
    this.client = norq.createClient(this.model_with_schema);
    callback();
  },

  tearDown: function (callback) {
    callback();
  },

  'is a method of NorqClient instances': function (test) {
    test.expect(1);
    var validation = this.client.validate('work', {});
    test.equal(validation.valid, false);
    test.done();
  },
  
  'in push passes errors to callback': function (test) {
    test.expect(3);
    this.client.push('work', { quantity: 'wrong type' }, function (err, result) {
      test.equal(result, undefined);
      test.equal(err.message[0].message, 'is missing and it is not optional');
      test.equal(err.message[1].message, 'string value found, but a number is required');
      test.done();
    }); 
  },

  'in set passes errors to callback': function (test) {
    test.expect(3);
    var client = this.client;
    var data = { description: 'about', quantity: 123 };
    client.push('work', data, function (err, result) {
      client.set('work', result._id, { quantity: 'wrong type' }, function (err, result) {
        test.equal(result, undefined);
        test.equal(err.message[0].message, 'is missing and it is not optional');
        test.equal(err.message[1].message, 'string value found, but a number is required');
        test.done();
      }); 
    });
  },
   
});
