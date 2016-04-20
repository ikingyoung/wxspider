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
        //console.log("wx query url : " + requestUrl);
        request(requestUrl, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            $= cheerio.load(body);
            var href = $('div.wx-rb.bg-blue.wx-rb_v1._item').attr('href');

            if(href){
                console.log(helper.stringFormat("OK - Get Artical List Url: {0}",href)); // Show the HTML for the Google homepage.
                emitter.emit("nodeCollect",href);
            }else{
                console.log("Fail - Get Artical List Url:");
            }
          }else{
            console.error(error);
          }
        });
    }
    //
    function nodeCollect(articalsListUrl){
        var requestUrl = articalsListUrl;// get first page json
        //console.log(requestUrl);
        request(requestUrl, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            $= cheerio.load(body);
            // 从html中获取所有的<script>元素
            var jsContent = $('script');
            var jsCode =jsContent[5].children[0].data
            // 替换\
            jsCode=replaceAll(jsCode,"\\","");
            //console.log(jsCode);
            // js中的json字符串截取出来，拼装称json格式
            var jsonStr = "{"+paraseJson(jsCode)+"}";
            // console.log(jsonStr);
            var msgJsonList =  JSON.parse(jsonStr);
            // 遍历json对象，存入数据库中
            if(msgJsonList.list && msgJsonList.list.length>0){

                // 先把数据库中的老数据给删除，再插入新数据
                Article.remove({}).exec(function(err, numberAffected, rawResponse){
                    if(err){
                        console.log("Fail: Remove Data.")
                        console.log(err);
                        return;
                    }
                    console.log("Remove Old Data.");
                    msgJsonList.list.forEach(function(msg){
                        emitter.emit("saveArticle",msg);
                        // console.log(msgJson2Article(msg));
                    });
                });

            }
          }else{
            console.error(error);
          }
        });
    }

    // 保存数据
    function saveArticle(jsonObj){
        var article = msgJson2Article(jsonObj);
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
    emitter.on("nodeCollect",nodeCollect);
    emitter.on("saveArticle",saveArticle);

    /*
        private methods
    */
    function paraseJson(jsCode){
        var reg = /msgList = '{([^']+)}'/g;
        var jsonStr=reg.exec(jsCode)[1];
        var text = convertHtml(jsonStr,false);
        text = convertHtml(text,false);
        return text;
    }

    function replaceAll(orgStr, tagStr, newStr){
        while (orgStr.indexOf(tagStr) >= 0){
           orgStr = orgStr.replace(tagStr, newStr);
        }
        return orgStr;
     }
    function convertHtml(self,encode) {
        var re=["&#39;", "'", "&quot;", '"', "&nbsp;", " ", "&gt;", ">", "&lt;", "<", "&amp;", "&", "&yen;", "¥"];
        if (encode) {
            re.reverse();
        }
        for (var i=0,str=self;i< re.length;i+= 2) {
             str=str.replace(new RegExp(re[i],'g'),re[i+1]);
        }
        return str;
    }
    // 构建存储到数据库中的数据实体
    function msgJson2Article(msg){
        var titleValue =msg.app_msg_ext_info.title;
        var urlValue=config.rootUrl+msg.app_msg_ext_info.content_url;
        var imglinkValue=msg.app_msg_ext_info.cover;
        var publishdateValue=dateFormat(new Date(msg.comm_msg_info.datetime * 1000),"yyyy-MM-dd");

        var article = new Article({
            title:titleValue,
            url:urlValue,
            imglink:imglinkValue,
            publishdate:publishdateValue,
        });

        return article;
    }
    // 格式化日期显示格式，yyyy-MM-dd HH:mm:ss
    function dateFormat(dt,fmt){
        var o = {
            "M+" : dt.getMonth()+1,                 //月份
            "d+" : dt.getDate(),                    //日
            "h+" : dt.getHours(),                   //小时
            "m+" : dt.getMinutes(),                 //分
            "s+" : dt.getSeconds(),                 //秒
            "q+" : Math.floor((dt.getMonth()+3)/3), //季度
            "S"  : dt.getMilliseconds()             //毫秒
        };
        if(/(y+)/.test(fmt))
            fmt=fmt.replace(RegExp.$1, (dt.getFullYear()+"").substr(4 - RegExp.$1.length));
        for(var k in o)
            if(new RegExp("("+ k +")").test(fmt))
        fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
        return fmt;
    }

    /*
        public methods
    */
    this.doWork=function(){
        emitter.emit("nodeDataParse");
    }

};
module.exports=spider;