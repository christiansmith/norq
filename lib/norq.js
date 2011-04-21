/*!
 * Norq
 * Copyright(c) 2011 Christian Smith <smith@anvil.io>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var redis = require('redis')
  , util = require('util')
  , uuid = require('node-uuid')
  , validate = require('./json-schema').validate;

/**
 * QueueNotFound Error
 */

function QueueNotFoundError() {
  this.name = 'QueueNotFoundError';
  this.message = 'Queue not found.';
  Error.call(this, this.message);
  Error.captureStackTrace(this, arguments.callee);
}

util.inherits(QueueNotFoundError, Error);
exports.QueueNotFoundError = QueueNotFoundError;

/**
 * DataNotObject Error
 */

function DataNotObjectError() {
  this.name = 'DataNotObjectError';
  this.message = 'Data must be an object.';
  Error.call(this, this.message);
  Error.captureStackTrace(this, arguments.callee);
}

util.inherits(DataNotObjectError, Error);
exports.DataNotObjectError = DataNotObjectError;

/**
 * InvalidIdError
 *
 * Data passed to NorqClient.prototype.set must have 
 * an _id property that matches the id argument.
 */

function InvalidIdError() {
  this.name = 'InvalidIdError';
  this.message = 'Data must have an _id property that matches the id argument.';
  Error.call(this, this.message);
  Error.captureStackTrace(this, arguments.callee);
}

util.inherits(InvalidIdError, Error);
exports.InvalidIdError = InvalidIdError;

/**
 * JSONValidationError
 */

function JSONValidationError(validation) {
  this.name = 'JSONValidationError';
  this.message = validation.errors;
  Error.call(this, JSON.stringify(this.message));
}

util.inherits(JSONValidationError, Error);
exports.JSONValidationError = JSONValidationError;

/**
 * Initialize a new `NorqClient`
 *
 * @param {Object} model
 * @param {Object} client
 * @api public
 */

function NorqClient(model, client) {
  if (typeof model !== 'object') throw new Error('Invalid model.');
  if (!(client instanceof redis.RedisClient)) throw new Error('Invalid client');

  // should client be private?
  this.model = model;
  this.client = client;
}

exports.NorqClient = NorqClient;

/**
 * Validate data for a queue.
 *
 * @param {String} queue
 * @param {Object} data
 * @api public
 */

NorqClient.prototype.validate = function (queue, data) {
  return validate(data, this.model[queue].schema);
};

/**
 * Push data onto a queue.
 *
 * @param {String} queue
 * @param {Object} data
 * @param {Function} callback
 * @api public
 */

NorqClient.prototype.push = function(queue, data, callback) {
  // ensure queue is defined in the model
  queue = this.model[queue];
  if (typeof queue !== 'object') {
    return callback(new QueueNotFoundError());
  }
  
  // cast a string to json
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (err) {
      return callback(new DataNotObjectError());      
    }
  }

  // ensure the data passed in a non-null object
  if (typeof data !== 'object' || data === null) {
    return callback(new DataNotObjectError());
  }

  // validate against a schema defined in the model.
  // if schema is null or undefined, validate() won't fail.
  // need to think about this a little deeper.
  // 
  var validation = validate(data, queue.schema);
  if (!validation.valid) {
    return callback(new JSONValidationError(validation));
  } 

  // ensure the data has a unique id if 
  // not provided
  var id; 
  data._id = id = data._id || uuid();

  // prepare args for Redis
  var key = queue.name + ':' + id,
      score = new Date().getTime();

  data = JSON.stringify(data);

  // make sure client is available in the callback
  // passed to exec()
  var client = this.client;

  // send a transaction to Redis
  client.multi()
    .zadd(queue.name, score, id)
    .set(key, data)
    .exec(function (err, replies) {

      // if the first reply (corresponding to zadd)
      // is not 1, delete the key and pass the first reply 
      // to the callback
      if (replies[0] !== 1) {
        client.del(key);
        return callback(new Error(replies[0]));
      }

      var response = {
        _id: id,
        status: replies
      }

      return callback(null, response);
    });

};

/**
 * Peek at the next item in a queue
 *
 * @param {String} queue
 * @param {Function} callback
 * @api public
 */

NorqClient.prototype.peek = function(queue, callback) {
  var client = this.client;

  // ensure queue is defined in the model
  if (typeof this.model[queue] !== 'object') {
    return callback(new QueueNotFoundError());
  }

  client.zrange(queue, 0, 0, function (err, result) {
    if (err) return callback(err);

    var id = result,
        key = queue + ':' + id;

    client.get(key, function (err, result) {
      return callback(null, result);
    });
  });
};

/**
 * Pop the next item from a queue
 *
 * @param {String} queue
 * @param {Function} callback
 * @api public
 */

NorqClient.prototype.pop = function(queue, callback) {
  var that = this,
      client = this.client;

  // ensure queue is defined in the model
  if (typeof this.model[queue] !== 'object') {
    return callback(new QueueNotFoundError());
  }

  client.zrange(queue, 0, 0, function (err, result) {
    if (err) return callback(err); 

    var id = result,
        key = queue + ':' + id;

    client.get(key, function (err, data) {
      var data = data; // temporary
      that.remove(queue, id, function (err, result) {
        return callback(null, data);
      });
    });
  });
};

/* composing pop from peek and remove
NorqClient.prototype.pop = function(queue, callback) {
  var that = this;
  that.peek(queue, function (err, data) {
    // this sucks because we need to parse data just to get _id.
    // could be slow for very large documents
    that.remove(queue, JSON.parse(data)._id, function (err, result) {
      callback(null, data);
    });
  });
};
*/

/**
 * Get the size of a queue
 *
 * @param {String} queue
 * @param {Function} callback
 * @api public
 */

NorqClient.prototype.size = function(queue, callback) {
  // ensure queue is defined in the model
  if (typeof this.model[queue] !== 'object') {
    return callback(new QueueNotFoundError());
  }

  this.client.zcard(queue, function (err, result) {
    if (err) return callback(err);
    return callback(null, result); 
  }); 
};

/**
 * Get a range of items (by index) from a queue
 *
 * @param {String} queue
 * @param {Number} start
 * @param {Number} end
 * @param {Function} callback
 * @api public
 */

NorqClient.prototype.range = function(queue, start, end, callback) {
  // ensure queue is defined in the model
  if (typeof this.model[queue] !== 'object') {
    return callback(new QueueNotFoundError());
  }

  var client = this.client;
  client.zrange(queue, start, end, function (err, keys) {
    if (err) return callback(err);

    // ensure an empty array gets passed to the callback 
    // if zrange brings back null
    if (keys.length === 0) return callback(null, keys);

    var keys = keys.map(function (key) { 
      return queue + ':' + key; 
    });

    client.mget(keys, function (err, values) {
      return callback(null, values);
    });   
  });
};

/**
 * Get the first several items in a queue.
 *
 * @param {String} queue
 * @param {Number} len
 * @param {Function} callback
 * @api public
 */

NorqClient.prototype.head = function(queue, len, callback) {
  this.range(queue, 0, len - 1, callback);
};

/**
 * Get the last several items in a queue in reverse order.
 *
 * @param {String} queue
 * @param {Number} len
 * @param {Function} callback
 * @api public
 */


NorqClient.prototype.tail = function(queue, len, callback) {
  // ensure queue is defined in the model
  if (typeof this.model[queue] !== 'object') {
    return callback(new QueueNotFoundError());
  }

  var that = this;
  this.client.zcard(queue, function (err, size) {
    if (err) return callback(err);
    that.range(queue, size - len, -1, function (err, result) {
      return callback(null, result.reverse());
    }); 
  });
};

/**
 * Get an item from a queue by id.
 *
 * @param {String} queue
 * @param {String} id
 * @param {Function} callback
 * @api public
 */

NorqClient.prototype.get = function(queue, id, callback) {
  // ensure queue is defined in the model
  if (typeof this.model[queue] !== 'object') {
    return callback(new QueueNotFoundError());
  }

  var key = queue + ':' + id;
  this.client.get(key, function (err, result) {
    if (err) return callback(err);
    return callback(null, result); 
  });
};
 
/**
 * Set the value of an item in a queue by id.
 *
 * @param {String} queue
 * @param {String} id
 * @param {Object} data
 * @param {Function} callback
 * @api public
 */

NorqClient.prototype.set = function(queue, id, data, callback) {
  // ensure queue is defined in the model
  if (typeof this.model[queue] !== 'object') {
    return callback(new QueueNotFoundError());
  }

  // reference the queue object for convenience 
  queue = this.model[queue];

  // cast a string to json
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (err) {
      return callback(new DataNotObjectError());      
    }
  }

  // ensure data is an object
  if (typeof data !== 'object' || data === null) {
    return callback(new DataNotObjectError());
  }

  // validate against a schema defined in the model.
  // if schema is null or undefined, validate() won't fail.
  // need to think about this a little deeper.
  // this is duplicated in this.push() 
  var validation = validate(data, queue.schema);
  if (!validation.valid) {
    return callback(new JSONValidationError(validation));
  } 

  // ensure data has an _id and it matches id arg
  if (!data._id || data._id !== id) {
    return callback(new InvalidIdError());
  }

  var key = queue.name + ':' + id;
  this.client.set(key, JSON.stringify(data), function (err, result) {
    if (err) return callback(err);
    return callback(null, { _id: id, status: result });  
  });
};

/**
 * Remove an item from a queue by id.
 *
 * @param {String} queue
 * @param {String} id
 * @param {Function} callback
 * @api public
 */

NorqClient.prototype.remove = function(queue, id, callback) {
  // ensure queue is defined in the model
  if (typeof this.model[queue] !== 'object') {
    return callback(new QueueNotFoundError());
  }

  var key = queue + ':' + id;
  this.client.multi()
    .zrem(queue, id)
    .del(key)
    .exec(function (err, result) {
      return callback(null, result);    
    });
};

/**
 * Shortcut for `new NorqClient(...)`.
 *
 * @param {Object} model 
 * @param {Object} redis_config
 * @api public
 */

exports.createClient = function (model, redis_config) {
  var config = redis_config || {},
      port = config.port    || 6379,
      host = config.host    || '127.0.0.1',
      opts = config.options || {};

  var client = redis.createClient(port, host, opts);

  // model need not be an object
  // perhaps a file name or abbreviated description
  // which gets preprocessed here before passing to 
  // NorqClient

  return new NorqClient(model, client);
};
