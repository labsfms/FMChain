class ProductCode{
	constructor(number,len){
		this.number = number
		this.len = len
		this.middle = Math.floor(number / 2)
	}
	
	change(str,index){
		let len = Math.floor(str.length / 2)
		if(len < 1){
			return str
		}
		
		if(index <= this.middle){
			var word = ["Q","W","E","R","T","Y","U","P","A","S"]
		}else{
			var word = ["M","F","G","H","J","K","X","C","V","N"]
		}
	
		let newStr = []
		let keys = []
		for(let i=0,l=str.length; i<l; i++){
			newStr.push(Number(str.charAt(i)))
			keys.push(i)
		}
	
	
		for(let i=0; i<len; i++){
			let r = Math.floor(Math.random() * (keys.length - 0 + 1) + 0)
			let k = (keys.splice(r,1))[0]
			newStr[k] = word[newStr[k]]
		
		}
	
		return newStr.join("")
	}
	
	generate(){
		let len = this.len
		var codes = []
		let count = 1
		for(let i=12345678; true; i += 3){
			let str = String(i).padStart(len,"0")
			let res = this.change(str,i)
			if(codes.includes(res)){
				console.log("repeat")
				return
				break
			}
			codes.push(res)
			
			count ++
			if(count > this.number){
				break
			}
		}
		return codes
	}
}

module.exports = ProductCode
