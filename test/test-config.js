var nodeunit = require('nodeunit')
  , config = require('../lib/config');


exports['defaults'] = nodeunit.testCase({

  'specifies redis host, port, db, and options': function (test) {
    test.expect(4);
    test.ok(typeof config.defaults.redis.host === 'string');
    test.ok(typeof config.defaults.redis.port === 'number');
    test.ok(typeof config.defaults.redis.db === 'number');
    test.ok(typeof config.defaults.redis.options === 'object');
    test.done();
  },
  
  'specifies http port': function (test) {
    test.expect(1);
    test.ok(typeof config.defaults.http.port === 'number');
    test.done();
  },
  
  'specifies logs': function (test) {
    test.expect(3);
    test.ok(config.defaults.logs instanceof Array);
    test.ok(typeof config.defaults.logs[0] === 'string');
    test.ok(typeof config.defaults.logs[1] === 'object');
    test.done();
  },

  'specifies model': function (test) {
    test.expect(1);
    test.ok(typeof config.defaults.model === 'object');
    test.done();
  }

});

exports['read'] = nodeunit.testCase({

  'returns JSON from norq.json': function (test) {
    test.expect(1);
    var conf = config.read('./test/norq.json');
    test.equal(typeof conf, 'object');
    test.done();
  },
  
  'catches errors': function (test) {
    test.expect(1);
    var conf = config.read('doesntexist');
    test.ok(conf.error instanceof Error);
    test.done();
  }

});

exports['merge'] = nodeunit.testCase({

  setUp: function (callback) {
    this.additional = { name: 'custom config' };
    this.override = {
      name: 'custom config',
      model: { work: { name: 'work' }}
    };
    callback();
  },

  'returns a new object with properties of `obj` and defaults': function (test) {
    test.expect(3);
    var conf = config.merge(this.additional);
    test.equal(conf.redis.port, 6379);
    test.equal(conf.name, 'custom config');
    test.equal(conf.model.default.name, 'default');
    test.done();
  },
  
  'overrides defaults with `obj` properties': function (test) {
    test.expect(2);
    var conf = config.merge(this.override);
    test.equal(conf.model.work.name, 'work');
    test.equal(conf.model.default, undefined);
    test.done();
  }

});

exports['load'] = nodeunit.testCase({

  setUp: function (callback) {
    this.expected = JSON.stringify({
      redis: {
        host: '127.0.0.1',
        port: 6379,
        options: {}
      },
      http: {
        port: 5150
      }, 
      logs: [
        'Console',
        { transport: 'File',
          options: { filename: 'logs/http.log' }}
      ],
      model: {
        work: {
          name: 'work',
          schema: { type: 'object' }
        }
      }
    });
    callback();
  },

  'merges JSON from file into defaults': function (test) {
    test.expect(1);
    var conf = config.load('./test/norq-test.json');
    test.equal(this.expected, JSON.stringify(conf));
    test.done();
  }

});
