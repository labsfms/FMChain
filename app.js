let ProductCode = require("./lib/ProductCode.js")
const fs = require('fs')
const path = require('path')
const mineType = require('mime-types')

var ipfsAPI = require('ipfs-api')
let md5 = require("md5")
var solc = require('solc')

let db = require("./lib/DB.js")
let funcs = require("./common/function.js")
var successReturn = funcs.successReturn
var failReturn = funcs.failReturn
var getWeb3 = funcs.getWeb3
let EthereumTx = require("ethereumjs-tx")
var express = require('express')
var bodyParser = require('body-parser')
let app = new express()

let from = "0xe19AaB117aD5B2ABD2F5113c5190B3198476b2bF"
let prikey = "25e98452fb0e83d72b73f42e9884268566577aa89cfe2ebcb3004c6a9c6737bd"
let nonce = 0
var ipfs = ipfsAPI('47.74.46.209', '5001', {protocol: 'http'})

app.get('/uploadchain', function (req, rep) {
	let goodsId = req.query.id
	
	let where = {goods_id:goodsId}
	
	
	//商品属性
	let attr = []
	db.table("goods_attr").field("title,value").where(where).select(res=>{
		if(res){
			attr = res
		}
	})
	
	//商品图片
	var gallery = []
	db.table("goods_gallery").field("img_url").where(where).select(res=>{
		if(res){
			gallery = res
		}
	})
	db.table("goods").field("goods_id,cat_id,goods_sn,goods_number,market_price,goods_weight,unit_id,user_reward_money,code_type").where(where).find(res=>{
		let goods = res
		if(!goods) return
		
		db.table("category").where({cat_id:goods.cat_id}).field("cat_name").find(res=>{
			if(res){
				goods.cat_name = res.cat_name
			}
		})
		
		db.table("unit").where({unit_id:goods.unit_id}).field("unit_name").find(res=>{
			if(res){
				goods.unit = res.unit_name
			}
		})
		
		goods.attr = attr
		goods.gallery = []
		gallery.forEach(v=>{
			let imgPath = path.resolve("/home/wwwroot/source/public",v.img_url)
			let data = fs.readFileSync(imgPath)
			data = new Buffer(data).toString('base64')
			let base64 = 'data:' + mineType.lookup(imgPath) + ';base64,' + data
			goods.gallery.push(base64)
		})
		
		let codeType = goods.code_type
		
		let commonCode = "" //统一码
		let codeHash = "" //存放商品唯一编号的文件
		let goodsHash = "" //存放商品信息的文件
		let insertSolidity = `
			product_type = ${codeType};
			admins.push(0x1b3c2941e994170ED4219c912E6a6718F38005af);
			admins.push(0x9bbddaEdbCa241EEB34686b63D4cA0AdD2B32AAe);
			admins.push(0x040f1e891717Ec63Df9d04be0fab6658d2A2B2df);
			admins.push(0x82E55FCD27C75E15C3a694589189be997D45D279);
		`
		let upLoad = function(){
			
			/*********** 开始创建合约  ****************/
			//创建合约
			let source = `pragma solidity ^0.4.24;
				contract Ballot{
				    struct Record{
				        string location; //购买地址 
				        uint256 date;  //购买日期时间戳 
				        string price; //购买价格  
				        uint16 number; //购买数量 
				        string info_ipfs_address; //提交的信息的ipfs地址
				    }
				    
				    struct ProductLog{
				        string content; //日志内容
				        uint256 date; //日期
				    }
				    
				    
					address public owner; //token拥有者
					uint8 product_type; //商品类型 1：一件一码，2：统一码
					string public product_ipfs_address; //商品信息ipfs地址 
					string internal unique_code_ipfs_address; //商品唯一码ipfs地址
					string public common_code; //商品统一码
					uint256 public recordCount = 0; //提交验证数量
					address[] admins; //管理员
					mapping(string => Record) uniqueRecordList;
					Record[] commonRecordList;
					ProductLog[] productLog;
					
					function Ballot() public{
					    owner = msg.sender;
				
					    ${insertSolidity}
					}
					
					//添加一条统一码商品验证记录
					function addCommonRecord(string location,uint256 date,string price,uint16 number,string info_ipfs_address){
					    require(msg.sender == owner || isAdmin(msg.sender));
					    commonRecordList.push(Record(location,date,price,number,info_ipfs_address));
					    recordCount ++;
					}
					
					//获取一个统一码商品信息
					function getCommonRecord(uint256 index) returns(string,uint256,string,uint16,string){
					    Record record = commonRecordList[index];
					    return (record.location,record.date,record.price,record.number,record.info_ipfs_address);
					}
					
					//增加一条唯一码商品验证记录
					function addUniqueRecord(string key,string location,uint256 date,string price,uint16 number,string info_ipfs_address) public{
					    require((msg.sender == owner || isAdmin(msg.sender) == true) && uniqueRecordIsExists(key) == false);
					    uniqueRecordList[key] = Record(location,date,price,number,info_ipfs_address);
					    recordCount ++;
					}
					
					//唯一码商品验证是否已经存在
					function uniqueRecordIsExists(string key) public constant returns(bool){
					    Record record = uniqueRecordList[key];
					    return record.date > 0 ? true : false;
					}
					
					//获取某个商品的验证信息
					function getUniqueRecord(string key) public constant returns(string,uint256,string,uint16,string){
					    Record record = uniqueRecordList[key];
					    return (record.location,record.date,record.price,record.number,record.info_ipfs_address);
					}
					
					//增加一条商品日志
					function addProductLog(string content,uint256 date) public{
					    require(owner == msg.sender || isAdmin(msg.sender) == true);
					    productLog.push(ProductLog(content,date));
					}
					
					//查看商品日志数量
					function getProductLogCount() public constant returns(uint256){
					    return productLog.length;
					}
					
					//获取某一条商品日志
					function getProductLog(uint256 index) public constant returns(string,uint256){
					    ProductLog log = productLog[index];
					    return (log.content,log.date);
					}
					
					//设置商品信息ifps地址
					function setProducIpfsAddress(string ipfsAddress) public{
						require(msg.sender == owner || isAdmin(msg.sender));
						bytes tmp = bytes(product_ipfs_address);
						require(tmp.length == 0);
						product_ipfs_address = ipfsAddress;
					}
					
					
					//获取商品唯一码ipfs地址
					function getUniqueCodeIpfsAddress() public constant returns(string){
					    require(msg.sender == owner || isAdmin(msg.sender));
					    return unique_code_ipfs_address;
					}
					
					
					function isAdmin(address addr) public constant returns(bool){
					    bool res = false;
					    uint256 len = admins.length;
					    for(uint256 i=0; i<len; i++){
					        if(admins[i] == addr){
					            res = true;
					            break;
					        }
					    }
					    return res;
					}
					
					function addAdmin(address addr) public{
					    require(msg.sender == owner && addr != owner && isAdmin(addr) == false);
					    admins.push(addr);
					}
				    
				    function delAdmin(address addr) public{
				        require(msg.sender == owner && addr != owner);
				        address[] newAdmins;
				        uint256 len = admins.length;
					    for(uint256 i=0; i<len; i++){
					        if(admins[i] != addr){
					            newAdmins.push(admins[i]);
					        }
					    }
					    
					    if(newAdmins.length < admins.length){
					        admins = newAdmins;
					    }
				    }
				    
				    function adminsCount() public constant returns(uint256){
				        require(msg.sender == owner);
				        return admins.length;
				    }
				    
				    function getAdmins() public constant returns(address[]){
				        require(msg.sender == owner);
				        return admins;
				    }
				}`
			let web3 = getWeb3()
			var output = solc.compile(source,1)
			let byteCode = ""
			let abi = null
			for(var contractName in output.contracts) {
				let contract = output.contracts[contractName]
				byteCode = contract.bytecode
				abi = JSON.parse(contract.interface)
			}
			
			if(!byteCode){
				db.rollback()
				rep.send(failReturn("合约编译错误"))
				return
			}
			web3.eth.getTransactionCount(from,function(err,n){
				if(n > nonce){
					nonce = n
				}
				let t = {
					nonce : nonce,
					from : from,
					to : "",
					gasPrice: web3.utils.toHex(20 * Math.pow(10,9)),
					gasLimit: web3.utils.toHex(600000),
					value: web3.utils.toHex(0 * Math.pow(10,18)),
					data : "0x" + byteCode,
				}
				
				let privateKey = Buffer.from(prikey, 'hex')
				var tx = new EthereumTx(t)
				tx.sign(privateKey)
				let serializedTx = '0x' + tx.serialize().toString('hex')
				console.log("create token:" + nonce)
				web3.eth.sendSignedTransaction(serializedTx,function(err,hash){
					if(err){
						/*db.rollback()
						rep.send(failReturn(err.message + ", it is token inner err"))*/
						return
					}else{
						nonce ++
					}
				}).on("receipt",function(res){
					console.log("create token success")
					
					let updateData = {
						block_height : res.blockNumber,
						transaction_hash : res.transactionHash,
						token_address : res.contractAddress,
						goods_code_ipfs : codeHash
					}
					web3.eth.getBlock(res.blockNumber).then(function(res){
							updateData.chain_time = res.timestamp
					})
					/********** 创建合约结束 **************************/
					goods.token_address = updateData.token_address
					ipfs.files.add(new Buffer(JSON.stringify(goods)),(err, files)=>{
						if(err){
							db.rollback()
							rep.send(failReturn(err.message))
							return
						}
				
						goodsHash = files[0].hash
						updateData.goods_info_ipfs = goodsHash
						
						//设置合约里的商品信息ipfs地址
						try{
							var token = new web3.eth.Contract(abi, updateData.token_address)
						}catch(e){
							db.rollback()
							rep.send(failReturn(e.message))
							return
						}
						let t = {
							nonce : nonce,
							from : from,
							to : updateData.token_address,
							gasPrice: web3.utils.toHex(20 * Math.pow(10,9)),
							gasLimit: web3.utils.toHex(600000),
							value: '0x00'
						}
						
						try{
							t.data = token.methods.setProducIpfsAddress(goodsHash).encodeABI()
						}catch(e){
							db.rollback()
							rep.send(failReturn(e.message))
							return
						}
						
						let privateKey = Buffer.from(prikey, 'hex')
						var tx = new EthereumTx(t)
						tx.sign(privateKey)
						let serializedTx = '0x' + tx.serialize().toString('hex')
						console.log("set ipfs:" + nonce)
						web3.eth.sendSignedTransaction(serializedTx,function(err,hash){
							if(err){
								/*db.rollback()
								rep.send(failReturn(err.message))*/
								return
							}else{
								nonce ++
							}
						}).on("receipt",function(res){
							console.log("set ipfs success")
							db.table("goods").where(where).update(updateData,function(){
								db.commit()
								rep.send(successReturn())
							})
						}).on("error",function(e){
							db.rollback()
							rep.send(failReturn(e.message))
						})
						
					})
					
					
				}).on("error",function(e){
					db.rollback()
					rep.send(failReturn(e.message))
				})
				
				
			})
			
			
			
			
			
		}
		
		if(codeType == 1){//商品唯一编号	
			let productCode = new ProductCode(goods.goods_number,6)
			let goods_sn = productCode.generate()
			let codes = []
			let count = Math.ceil(goods.goods_number / 5000)
			let num = 0
			for(let i=0; i<count; i++){
				codes[i] = []
				for(let j=0; j<5000; j++){
					if(num >= goods.goods_number){
						break
					}
					codes[i].push({goods_id:goodsId,code:goods_sn[num]})
					num ++
				}
			}
			
			db.startTrans(()=>{
				codes.forEach(v=>{
					db.table("goods_code").addAll(v)
				})
				codes = null
			})
			
			ipfs.files.add(new Buffer(goods_sn.join("\r\n")),(err,files)=>{
				if(err){
					db.rollback()
					rep.send(failReturn(err.message))
					return
				}
				codeHash = files[0].hash
				insertSolidity += `
					unique_code_ipfs_address = "${codeHash}";
				`
				upLoad()
			})
			
			goods_sn = null
		}else{ //统一码
			let productCode = new ProductCode(1,6)
			let goods_sn = productCode.generate()
			commonCode = goods_sn[0]
			insertSolidity += `
				common_code = "${commonCode}";
			`
			db.startTrans(()=>{
				db.table("goods_common_code").add({goods_id:goodsId,code:commonCode})
			})
			upLoad()
		}
		
	})
})


var server = app.listen(7777, function () {
  var host = server.address().address
  var port = server.address().port
})