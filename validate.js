const fs = require('fs')
const path = require('path')
const mineType = require('mime-types')

var ipfsAPI = require('ipfs-api')
let redis = require("redis")
let db = require("./lib/DB.js")

let abi = require("./lib/abi.js")
let funcs = require("./common/function.js")
var getWeb3 = funcs.getWeb3
var getOrderSn = funcs.getOrderSn
let EthereumTx = require("ethereumjs-tx")

let from = "" //交易发起人
let prikey = "" //发起人私钥
let nonce = 0

function toFixed(number,accuracy){
	if(accuracy === undefined){
		accuracy = 2
	}
	number = String(number)
	var index = number.indexOf(".")
	if(index < 0){
		return Number(number)
	}else{
		let n0 = Math.floor(number)
		let n1 = number.substr(index+1,accuracy)
		return Number(n0 + "." + n1)
	}
	
}


var ipfs = ipfsAPI('127.0.0.1', '5001', {protocol: 'http'})
let client = redis.createClient({
	host : "127.0.0.1"
})
client.on("error",res=>{
	throw res
})


function addErrLog(log){
	console.log(log)
	db.table("validata_error_log").add(log)
}


function validate(){
	client.rpop("wait_validate_list",(err,task)=>{
		//task = '{"code":"1G3J5NG4","id":78,"code_id":381}'
		if(!task){
			setTimeout(()=>{
				validate()
			},5000)
			return
		}
		task = funcs.json_decode(task)
		let antiId = parseInt(task.id)
		let codeId = parseInt(task.code_id)
		let code = task.code
		let anti = null
		let tx = ""
		let errLog = {anti_id:antiId,code:code,code_id:codeId}
		db.table("anti_fake").where({id:antiId}).field("buy_time,user_id,goods_id,price,num,address").find(res=>{
			anti = res
		})
		db.table("anti_fake_img").where({anti_fake_id:antiId}).field("img").select(res=>{
			let web3 = getWeb3()
			
			var imgs = []
			if(res){
				imgs = res
			}
			var data = {
				info : anti,
				imgs : []
			}
			imgs.forEach(v=>{
				let imgPath = path.resolve("/home/wwwroot/source/public",v.img)
				let f = fs.readFileSync(imgPath)
				f = new Buffer(f).toString('base64')
				let base64 = 'data:' + mineType.lookup(imgPath) + ';base64,' + f
				data.imgs.push(base64)
			})
			let goodsId = anti.goods_id
			let contractAddress = ""
			db.table("goods").where({goods_id:goodsId}).field("token_address,goods_number,user_reward_money,coin_balance,verify_number").find(goods=>{
				contractAddress = goods.token_address
				let contract = new web3.eth.Contract(abi,contractAddress)
				let send = ()=>{
					var t = {
						nonce : nonce,
						from : from,
						to : contractAddress,
						gasPrice: web3.utils.toHex(10 * Math.pow(10,9)),
						gasLimit: web3.utils.toHex(6000000),
						value: web3.utils.toHex(0 * Math.pow(10,18))
					}
					
					ipfs.files.add(new Buffer(JSON.stringify(data)),(err, files)=>{
						if(err){
							errLog.mark = "ipfs.files.add"
							errLog.err_msg = "err:" + err.message
							addErrLog(errLog)
							validate()
							return
						}
						let ipfsHash = files[0].hash
						let userid = anti.user_id
						try{
							t.data = contract.methods.addRecord(code,anti.address,anti.buy_time,String(anti.price),anti.num,ipfsHash).encodeABI()
						}catch(e){
							errLog.mark = "addRecord"
							errLog.err_msg = "catch:" + e.message
							addErrLog(errLog)
							validate()
							return
						}
						let privateKey = Buffer.from(prikey, 'hex')
						var tx = new EthereumTx(t)
						tx.sign(privateKey)
						let serializedTx = '0x' + tx.serialize().toString('hex')
						web3.eth.sendSignedTransaction(serializedTx,function(err,hash){
							if(err){
								return
							}else{
								nonce ++
								errLog.tx = hash
							}
						}).on("receipt",function(res){
							console.log(res)
							var status = web3.utils.hexToNumber(res.status)
							if(status !== 1){
								errLog.mark = "receipt"
								errLog.err_msg = "status=0x0"
								addErrLog(errLog)
								validate()
								return
							}else{
								let userid = anti.user_id
								db.table("user_asset").field("number").where({user_id:userid}).find(res=>{
									let userBalance = res.number
									let time = funcs.time()
									let reward = 0.001
									//剩下多少码还没被验证
									let surplus = goods.goods_number - goods.verify_number
									//剩下多少币
									let coinBalance = goods.coin_balance
									if(surplus == 1){ //最后一个人
										reward = coinBalance
									}else{
										let avg = toFixed(coinBalance / surplus,3)
										if(avg <= 0.001){
											reward = avg
										}else if(avg <= 0.002){
											reward = 0.001
											let availableBalance = coinBalance - reward*surplus //可以用到的币
											reward += toFixed(availableBalance / 2 * Math.random(),3)
										}else if(avg <= 1){
											reward = avg / 2
											let availableBalance = coinBalance - reward*surplus //可以用到的币
											reward += toFixed(availableBalance / 2 * Math.random(),3)
										}else if(avg < 5){
											reward = avg / 2
											reward += toFixed(3 * Math.random(),3)
										}else{
											reward = avg / 2
											reward += toFixed(avg / 2 * Math.random(),3)
										}
									}
									
									
									let sn = getOrderSn()
									db.table("anti_fake").where({id:antiId}).update({ipfs_address:ipfsHash,status:1,coin_number:reward,update_time:time})
									db.table("user_asset").where({user_id:userid}).incr({number:reward})
									db.table("goods").where({goods_id:goodsId}).incr({coin_balance:-reward,verify_number:1})
									db.table("goods_code").where({id:codeId}).update({mark:1,create_time:time})
									db.table("user_get_coin").add({order_sn:sn,user_id:userid,anti_id:antiId,balance:userBalance+reward,get_coin:reward,create_time:time,note:"提交防伪信息奖励"})
								})
								validate()
							}
						}).on("error",function(e){
							errLog.mark = "sendSignedTransaction"
							errLog.err_msg = "err:" + e.message
							addErrLog(errLog)
							validate()
						})
					})
				}
				


				send()
				
			})
			
		})
		
	})
}

validate()
