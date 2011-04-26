var nodeunit = require('nodeunit')
  , norq = require('norq')
  , logger = require('../lib/logger.js').logger
  , configure = require('../lib/logger.js').configure
  , util = require('util');


exports['configure'] = nodeunit.testCase({

  'initializes console transport': function (test) {
    test.expect(1);
    var logs = configure(['Console']);
    test.equal(logs[0].name, 'console');
    test.done();
  },
  
  'initializes file transport': function (test) {
    test.expect(1);
    var logs = configure([{ 
      transport: 'File', 
      options: { filename: 'test/winston.log' }
    }]);
    test.equal(logs[0].name, 'file');
    test.done();
  },  

  'initializes empty array': function (test) {
    test.expect(1);
    var logs = configure([]);
    test.ok(logs instanceof Array);
    test.done();
  },
  
  'initializes null': function (test) {
    test.expect(1);
    var logs = configure(null);
    test.ok(logs instanceof Array);
    test.done();
  },

  'initializes undefined': function (test) {
    test.expect(1);
    var logs = configure();
    test.ok(logs instanceof Array);
    test.done();
  }

});

exports['logger'] = nodeunit.testCase({

  'returns logger middleware': function (test) {
    test.expect(2);
    var middleware = logger(['Console']);
    test.ok(typeof middleware === 'function');
    test.equal(middleware.length, 3);
    test.done();
  }

});
