var nodeunit = require('nodeunit'),
    norq = require('../lib/norq')
    redis = require('redis');


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
    test.throws(function () {
        new norq.NorqClient();    
      }, Error,
      "unexpected error");
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

