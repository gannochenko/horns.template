/*
   Это тестовый {{   TEMPLATE}} и {{if oneHelper}} по условию {{elseif anotherHelper}} по другому условию {{ else }} иначе ... {{endif}} после условия {{{  unescaped }}}
*/

Parser = function (str)
{
	this.str = str.toString();
	this.struct = [];

	// each atom may be followed with space (sp), and space may be follewed with any instruction
	// atoms like "io", "iou" change context to 'instruction' and atoms "ic" and "icu" change context back to "text"
	// if "io" atom met, it must not be followed with "icu" or "iou" or another "io". The same rule for "iou"
	// a sequence of sym, symd and sp represents "symbol sequence", which lately should be mapped to either one of known helpers or a part of data object
	this.atom = {
		// space
		sp: {
			find: 	function(i){
				return this.findSeq(i, '\\s');
			},
			do: 	function(){},
			syn: 	['if_','elseif','el','endif', 'io', 'iou', 'ic','icu', 'sym','','','','','','','','']
		},
		// instruction open unsafe {{{
		iou: {
			find: 	function(i){
				return this.substr(i, '{{{');
			},
			do: 	function(){
				this.saveTextChunk();
				this.isInst(true);
			},
			syn: 	['icu','sym','','','','','','','','',],
		},
		// instruction open {{
		io: {
			find: 	function(i){
				return this.substr(i, '{{');
			},
			do: 	function(){
				this.saveTextChunk();
				this.isInst(true);
			},
			syn: 	['if_','elseif','el','endif', 'ic', 'sym','','','','','','','',''], // order is important, sym must go at the end as the last chance character to be recognized
		},
		// instruction close unsafe }}}
		icu: {
			find: 	function(i){
				return this.substr(i, '}}}');
			},
			do: 	function(){
				this.isTxt(true);
			},
			syn: 	['io','iou','','','','','','','',],
		},
		// instruction close }}
		ic: {
			find: 	function(i){
				return this.substr(i, '}}');
			},
			do: 	function(){
				this.isTxt(true);
			},
			syn: 	['io','iou','','','','','','','',],
		},
		// if
		if_: {
			find: 	function(i){
				return this.substr(i, 'if ');
			},
			do: 	function(){},
			syn: 	['sym','','','','','','','','',],
		},
		// elseif
		elseif: {
			find: 	function(i){
				return this.substr(i, 'elseif ');
			},
			do: 	function(){},
			syn: 	['sym','','','','','','','','',],
		},
		// else
		el: {
			find: 	function(i){
				return this.substr(i, 'else');
			},
			do: 	function(){},
			syn: 	['ic','','','','','','','','',],
		},
		// endif
		endif: {
			find: 	function(i){
				return this.substr(i, 'endif');
			},
			do: 	function(){},
			syn: 	['ic','','','','','','','','',]
		},
		// helper argument list open (
		hao: {
			find: 	function(i){
				return this.str[i] == '(';
			},
			do: 	function(){},
			syn: 	[]
		},
		// helper argument list close )
		hac: {
			find: 	function(i){
				return this.str[i] == ')';
			},
			do: 	function(){},
			syn: 	[]
		},
		// helper argument list separator ,
		has: {
			find: 	function(i){
				return this.str[i] == ',';
			},
			do: 	function(){},
			syn: 	[]
		},

		// all other is SYMBOL, goes at the end
		sym: {
			find: 	function(i){
				return this.findSeq(i, '[a-zA-Z0-9_\\.]');
			},
			do: 	function(){},
			syn: 	['ic','icu','','','','','','','',],
		},// introduce allowed characters here
	}

	console.dir(this.atom);

	var all = [];
	for(var k in this.atom)
	{
		if(k != 'sp')
		{
			this.atom[k].syn.push('sp');
		}
		all.push(k);

		var synRev = {};
		for(var j = 0; j < this.atom[k].syn.length; j++)
		{
			var m = this.atom[k].syn[j];
			if(m != '')
			{
				synRev[m] = true;
			}
		}
		this.atom[k].synR = synRev;
	}

	//console.dir(this.atom);

	this.vars = {
		ctxIns: false,
		at: null,
		chunk: '',
		all: all
	}
}
Parser.prototype.walk = function(i, cb)
{
	for(var k = i; k < this.str.length; k++)
	{
		if(cb.apply(this, [k]) === false)
		{
			break;
		}
	}
}
Parser.prototype.detectAtom = function(i)
{
	var ctx = this.vars.ctx;
	var at = this.vars.at;
	var expect = null;

	/*
	if(this.isTxt())
	{
		expect = ['io','iou']; // find instruction open
	}
	else
	{
		if(at == 'sp')
		{
			expect = this.vars.all;
		}
		else
		{
			expect = this.atom[at].syn;
		}
	}
	*/

	var found = false;
	var all = this.isTxt() ? ['iou','io'] : this.vars.all;
	for(var k = 0; k < all.length; k++)
	{
		if(all[k].length == 0)
		{
			continue;
		}

		//if(this.isInst())
		//console.dir('check for '+all[k]);

		found = this.atom[all[k]].find.apply(this, [i]);
		if(found !== false)
		{
			break;
		}
	}

	if(found === false) // nothing were found
	{
		if(this.isInst())
		{
			throw new Error('Parse error at '+i);
		}
		else
		{
			return {
				atom: false,
				offs: 1
			};
		}
	}
	else
	{
		console.dir('>>>>> at '+i+' found: '+all[k]+' with offset '+found.offs+' and value '+found.inst);
		//console.dir(at);

		// check if it was expected
		if(!this.checkExpected(all[k], at))
		{
			throw new Error('Unexpected '+all[k]);
		}

		this.vars.at = all[k];

		return {
			atom: 	all[k],
			val: 	found.inst,
			offs: 	found.offs
		};
	}
}
Parser.prototype.parse = function()
{
	if(this.str.length)
	{
		console.dir(this.str);

		var i = 0;
		var j = 0;
		var next = null;
		while(true)
		{
			//console.dir(j);

			if(j >= this.str.length - 1)
			{
				console.dir('end');
				this.saveTextChunk();
				return this.struct; // parse end
			}

			if(i >= this.str.length)
			{
				throw new Error('Internal: endless loop');
			}

			next = this.detectAtom(j);
			if(next.atom != false)
			{
				// do atom action
				this.evalAtom(next.atom);
			}
			else
			{
				if(this.isTxt())
				{
					this.appendChunk(j);
				}
			}

			j += next.offs;
			i++;
		}
	}
}
Parser.prototype.isTxt = function(sw)
{
	if(sw)
	{
		this.vars.ctxIns = false;
	}

	return !this.vars.ctxIns;
}
Parser.prototype.isInst = function(sw)
{
	if(sw)
	{
		this.vars.ctxIns = true;
	}

	return this.vars.ctxIns;
}
Parser.prototype.evalAtom = function(atom)
{
	return this.atom[atom].do.call(this);
}
Parser.prototype.saveTextChunk = function()
{
	if(this.vars.chunk != '')
	{
		this.struct.push({
			type: 'txt',
			val: this.vars.chunk
		});
		this.vars.chunk = '';
	}
}
Parser.prototype.appendChunk = function(i)
{
	this.vars.chunk += this.str[i];
}
Parser.prototype.substr = function(i, str)
{
	if(this.str.substr(i, str.length) == str)
	{
		return {
			offs: str.length,
			inst: str
		}
	}
	return false;
}
Parser.prototype.findSeq = function(i, expr)
{
	var expr = new RegExp('^('+expr+'+)');
	var substr = this.str.substr(i, this.str.length - i);

	var inst = false;
	var r = substr.match(expr);
	if(r != null && typeof r[1] != 'undefined')
	{
		inst = r[1];
	}

	if(inst === false)
	{
		return false;
	}

	return {
		offs: inst.length,
		inst: inst
	}
}
Parser.prototype.checkExpected = function(atom, afterAtom)
{
	if(afterAtom == null)// || afterAtom == 'sp')
	{
		return true;
	}

	return typeof this.atom[afterAtom].synR[atom] != 'undefined';
}