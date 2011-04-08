var redis = require('redis'),
    uuid = require('node-uuid');

function NorqClient(model, client) {
  if (typeof model !== 'object') throw new Error('Invalid model.');
  if (!(client instanceof redis.RedisClient)) throw new Error('Invalid client');

  // should client be protected by way of a closure?
  this.model = model;
  this.client = client;
}

exports.NorqClient = NorqClient;


NorqClient.prototype.push = function(queue, data, callback) {
  
  // ensure queue is defined in the model
  queue = this.model[queue];
  if (typeof queue !== 'object') {
    callback(new Error('Queue not found.'));
    return;
  }
  
  // ensure the data passed in is JSON
  // there are probably better ways to do this
  if (typeof data !== 'object' || data === null) {
    callback(new Error('Data must be an object.'));
    return;
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
        callback(replies[0]);
        return;
      }

      var response = {
        _id: id,
        status: replies
      }

      callback(null, response);
    });

};



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


