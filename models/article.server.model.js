var mongoose = require('mongoose');

var ArticleSchema =  new mongoose.Schema({
    title:String,
    url:String,
    imglink:String,
    publishdate:String,
});

mongoose.model('Article',ArticleSchema);