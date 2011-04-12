var norq = require('./norq'),
    repl = require('repl'),
    validate = require('./json-schema').validate,
    fs = require('fs');


function print (err, result) {
  if (err) {
    console.log(err);
  } else {
    console.log(result);
  }
}

fs.readFile('./model/model.json', function (err, model) {
  var model = JSON.parse(model.toString());
  fs.readFile('./config/config.json', function (err, config) {
    var config = JSON.parse(config.toString());
    var context = repl.start('norq> ').context;
    context.norq = norq;
    context.model = model;
    context.config = config;
    context.client = norq.createClient(model, config);
    context.validate = validate;
    context.print = print;
  }); 
});


