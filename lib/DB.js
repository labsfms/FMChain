var mysql = require("mysql")
class DB{
	constructor(){
		this.connection = mysql.createConnection({
			database : "database",
			host : "127.0.0.1",
  			user: 'root',              
  			password:'root',  
		})
		this.connection.connect()
	}
	
	where(param){
		var __where = "1=1"
		if(typeof param === "object"){
			for(var k in param){
				__where += " and `"+k+"` = '" + param[k] + "'"
			}
		}
		this._where = __where
		
		return this
	}
	
	field(param){
		var __field = []
		if(!param){
			this._field = "*"
		}else{
			if(typeof param === "string"){
				param = param.split(",")
			}
			param.forEach(function(v){
				__field.push("`" + v + "`")
			})
			this._field = __field.join(",")
		}
		
		return this
	}
	
	table(tablename){
		this._table = "`" + tablename + "`"
		return this
	}
	
	getLastSql(){
		return this.lastSql
	}
	
	startTrans(callback){
		this.connection.beginTransaction(function(err) {
			if(err){
				throw err
			}
			if(callback){
				callback()
			}
		})
	}
	
	
	
	rollback(){
		this.connection.rollback()
	}
	
	commit(){
		this.connection.commit()
	}
	
	add(param,callback){
		var fields = []
		var values = []
		for(var k in param){
			fields.push("`" + k + "`")
			values.push("'" + param[k] + "'")
		}
		fields = fields.join(",")
		values = values.join(",")
		var sql = "insert into " + this.buildTable() + " (" + fields + ") values(" + values + ")"
		
		this.connection.query(sql,function(err,result){
			var res = null
			if(err){
				console.log(err.message)
			}else{
				res = result.insertId
			}
			if(callback){
				callback(res)
			}
		})
	}
	
	addAll(params,callback){
		let _fields = []
		for(let k in params[0]){
			_fields.push("`" + k + "`")
		}
		let fields = _fields.join(",")
		
		let values = []
		params.forEach(param=>{
			let value = []
			for(let k in param){
				value.push(`'${param[k]}'`)
			}
			value = "(" + value.join(",") +")"
			values.push(value)
		})
		values = values.join(",")
		let sql = `insert into ${this.buildTable()} (${fields}) values ${values}`
		this.lastSql = sql
		this.connection.query(sql,function(err,result){
			var res = null
			if(err){
				console.log(err.message)
			}else{
				res = result.affectedRows
			}
			if(callback){
				callback(res)
			}
		})
	}
	
	find(callback){
		var sql = "select " + this.buildField() + " from " + this.buildTable() + " where " + this.buildWhere() + " limit 0,1"
		this.connection.query(sql,function(err,result){
			var res = null
			if(err){
				console.log(err.message)
			}else{
				res = result[0] || null
			}
			if(callback){
				callback(res)
			}
		})
	}
	
	select(callback){
		var sql = "select " + this.buildField() + " from " + this.buildTable() + " where " + this.buildWhere()
		this.connection.query(sql,function(err,result){
			var res = []
			if(err){
				console.log(err.message)
			}else{
				res = result
			}
			if(callback){
				callback(res)
			}
		})
	}
	
	update(data,callback){
		var updateData = []
		for(var k in data){
			updateData.push("`"+k+"`=" + "'" + data[k] + "'")
		}
		updateData = updateData.join(",")
		var t = this.buildTable()
		var w = this.buildWhere()
		var sql = `update ${t} set ${updateData} where ${w}`
		this.connection.query(sql,function(err,result){
			var req = null
			if(err){
				console.log(err.message)
			}else{
				req = result.affectedRows
			}
			if(callback){
				callback(req)
			}
		})
	}
	
	incr(data,callback){
		let updateData = []
		for(let k in data){
			updateData.push(`\`${k}\`=\`${k}\` + ${data[k]}`)	
		}
		updateData = updateData.join(",")
		var t = this.buildTable()
		var w = this.buildWhere()
		var sql = `update ${t} set ${updateData} where ${w}`
		
		this.connection.query(sql,function(err,result){
			var req = null
			if(err){
				console.log(err.message)
			}else{
				req = result.affectedRows
			}
			if(callback){
				callback(req)
			}
		})
	}
	
	delete(callback){
		var t = this.buildTable()
		var w = this.buildWhere()
		var sql = `delete from ${t} where ${w}`
		this.connection.query(sql,function(err,result){
			var req = null
			if(err){
				console.log(err.message)
			}else{
				req = result.affectedRows
			}
			if(callback){
				callback(req)
			}
		})
	}
	
	buildField(){
		return this._field || "*"
	}
	
	buildWhere(){
		return this._where || "1=1"
	}
	
	buildTable(){
		return this._table || ""
	}
}

module.exports  = new DB()
