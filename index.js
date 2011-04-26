var fs = require('fs');

module.exports = require('./lib/norq');
module.exports.server = require('./lib/http');
module.exports.logger = require('./lib/logger').logger;

module.exports.config = (function (path) {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch (err) {
    return err;
  }
})('./norq.json');

module.exports.print = function (err, result) {
  if (err) {
    console.log(err);
  } else {
    console.log(result);
  }
};
