function json_encode(data){
	return JSON.stringify(data)
}
function json_decode(data){
	return JSON.parse(data)
}


function getWeb3(){
	var Web3 = require("web3")
	var url = "http://47.74.46.209:9090"
	return new Web3(new Web3.providers.HttpProvider(url))
}
function time(){
	return Math.ceil(new Date().getTime() / 1000)
}

function sendReturn(msg,data){
	var res = {}
	if(typeof msg === "object"){
		data = msg
		msg = "success"
	}
	return JSON.stringify({error:0,data:data || [],msg:msg || "success"})
}
function failReturn(msg,error){
	return JSON.stringify({error:1,msg:msg || "fail"})
}

function query(search){
	var querys = search.split("&")
	var param = {}
	querys.forEach(function(v,i){
		var ktv = v.split("=")
		param[ktv[0]] = ktv[1] === undefined ? "" : ktv[1]
	})
	return param
}


function post(params){
	var Base64 = require('js-base64').Base64
	var md5 = require("md5")
	var key = "Xc3dpbW(MT#js!MVF5"
	params = query(Base64.decode(params))
	var sign = params._sign
	delete params._sign
	var keys = Object.keys(params).sort()
	var str = []
	keys.forEach(function(k){
		str.push(k + "=" + params[k])
	})
	str = str.join("&")
	var sign1 = md5(str + key)
	if(sign1 !== sign){
		return null
	}
	return params
}


function eToString(num){
	num = num.toString()
	if(num.includes("e")){ //科学计算
		var len = num.match(/(\+|e)\d+/i)[0]
		len = len.match(/\d+/)[0]
		
		var pre = num.match(/\d+\.?\d*e/i)[0]
		pre = num.match(/\d+\.?\d*/i)[0]
		
		var pres = pre.split(".")
		
		var pre0 = pres[0]
		var pre1 = ""
		if(pres[1] !== undefined){
			pre1 = pres[1]
			len -= pre1.length
		}
		num = pre0 + "" + pre1
		for(var i=0; i<len; i++){
			num += "0"
		}
	}
	return num
}

function getOrderSn(){
	return (new Date()).getTime()
}

module.exports = {
	getWeb3 : getWeb3,
	post : post,
	json_encode : json_encode,
	json_decode : json_decode,
	successReturn : sendReturn,
	failReturn : failReturn,
	time : time,
	eToString : eToString,
	getOrderSn : getOrderSn
}
