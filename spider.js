var events = require('events');
var emitter = new events.EventEmitter();
var cheerio = require('cheerio');
var request = require('request');
var helper= require("myhelper");
var config = require('./config/config.js');
var mongoosedb = require('./config/mongoose.js');
var db = mongoosedb();
var mongoose = require('mongoose');
var Article = mongoose.model('Article');

var spider = function(){

    var _queryExtKey="";

    /*
        event handles
    */
    // 根据微信号获取url中的ext
    function nodeDataParse(){
        var requestUrl= helper.stringFormat(config.wxQueryUrlTemplate,config.wxAccount);
        request(requestUrl, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            $= cheerio.load(body);
            var href = $('div.wx-rb.bg-blue.wx-rb_v1._item').attr('href');
            _queryExtKey = href.substring(href.indexOf('?')+1);
            if(_queryExtKey){
                console.log(helper.stringFormat("Get openid & expired key: {0}",_queryExtKey)); // Show the HTML for the Google homepage.
                emitter.emit("nodeCollect");
            }else{
                console.log("Fail : expired key");
            }
          }else{
            console.error(error);
          }
        });
    }
    //
    function nodeCollect(){
        var requestUrl = getRequestUrl(1);// get first page json
        request(requestUrl, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            var jsonStr= body.substring(body.indexOf("(")+1,body.lastIndexOf(")"));
            var obj = JSON.parse(jsonStr);
            if(obj){
                console.log(helper.stringFormat("Total Page Number: {0}",obj.totalPages)); // Show the HTML for the Google homepage.
                emitter.emit("nodeProcessTrigger",obj.totalPages);
            }else{
                console.log("Fail : get total page number ");
            }
          }else{
            console.error(error);
          }
        });
    }
    // 启动网页节点处理触器发事件
    function nodeProcessTrigger(totalPageNum){
        // remove all old data
        Article.remove({}).exec(function(err, numberAffected, rawResponse){
            if(err){
                console.log("Fail: Remove Data.")
                console.log(err);
                return;
            }
            console.log("Remove Data.");
            for (var i = totalPageNum; i >= 1; i--) {
                emitter.emit("nodeProcess",i);
            }
        });
    }
    // 处理单个网页节点数据事件
    function nodeProcess(pageNum){
        //console.log("Processing Page %d",pageNum);
        var requestUrl = getRequestUrl(pageNum);// get first page json
        request(requestUrl, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            var jsonObj =getJsonObj(body);
            if(jsonObj){
                if(jsonObj.items && jsonObj.items.length>0){
                    jsonObj.items.forEach(function(value){
                        emitter.emit("saveArticle",value);
                    });
                }else{
                    console.log(helper.stringFormat("Fail : Page {0}, no xml data.",pageNum));
                    return;
                }
            }else{
                console.log(helper.stringFormat("Fail : Page {0}, parse to json object fial.",pageNum));
                return;
            }
            // console.log(totalPages); // Show the HTML for the Google homepage.
          }else{
            console.log(helper.stringFormat("Fail : Page {0}",pageNum));
            console.error(error);
            return;
          }
        });
    }
    // 保存数据
    function saveArticle(xml){
        var article = parseXml2Article(xml);
        article.save(function(err,entity,numAffected){
            if(err){
                console.log(helper.stringFormat("Fail : Title [ {0} ]",entity.title));
                console.log(err);
                return;
            }
            console.log(helper.stringFormat("Success : Title [ {0} ]",entity.title));
        });
    }

    /*
        register events
    */
    emitter.on("nodeDataParse",nodeDataParse);
    emitter.on("nodeCollect",nodeCollect)
    emitter.on("nodeProcessTrigger",nodeProcessTrigger);
    emitter.on("nodeProcess",nodeProcess);
    emitter.on("saveArticle",saveArticle);

    /*
        private methods
    */

    function getRequestUrl(pageNum) {
        return helper.stringFormat(config.pageUrlTemplate,_queryExtKey,pageNum);
    }

    function getJsonObj(text){
        if(helper.stringIsNullOrEmpty(text))
            return null;

        var jsonStr= text.substring(text.indexOf("(")+1,text.lastIndexOf(")"));
        return JSON.parse(jsonStr);
    }

    function parseXml2Article(xml){
        var regTitle=/<title><!\[CDATA\[([^<]+)\]\]><\/title>/g;
        var regUrl=/<url><!\[CDATA\[([^<]+)\]\]><\/url>/g;
        var regImglink=/<imglink><!\[CDATA\[([^<]+)\]\]><\/imglink>/g;
        var regDate=/<date><!\[CDATA\[([^<]+)\]\]><\/date/g;

        var titleValue ="";
        var urlValue="";
        var imglinkValue="";
        var publishdateValue="";

        var items = regTitle.exec(xml);
        if(items && items.length>1){
            titleValue=items[1];
        }

        items=null;
        items = regUrl.exec(xml);
        if(items && items.length>1){
            urlValue=config.rootUrl+items[1];
        }

        items=null;
        items = regImglink.exec(xml);
        if(items && items.length>1){
            imglinkValue=items[1];
        }
        items=null;
        items=regDate.exec(xml);
        if(items && items.length>1){
            publishdateValue=items[1];
        }

        var article = new Article({
            title:titleValue,
            url:urlValue,
            imglink:imglinkValue,
            publishdate:publishdateValue,
        });

        return article;
    }
    /*
        public methods
    */
    this.doWork=function(){
        emitter.emit("nodeDataParse");
    }

};
module.exports=spider;